import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// Use Python's standard ZIP writer to build a three-part Word document in CI.
function createDocx(sample) {
  return execFileSync('python3', ['-c', `
import io, sys, zipfile
from xml.sax.saxutils import escape
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+escape(sys.argv[1])+'</w:t></w:r></w:p></w:body></w:document>')
sys.stdout.buffer.write(buf.getvalue())
`, sample]);
}

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
try {
  const pdfPage = await browser.newPage();
  await pdfPage.setContent('<main>Browser PDF Resume Example</main>');
  const pdf = await pdfPage.pdf({ format: 'A4' });
  await pdfPage.close();
  const page = await browser.newPage();
  const calls = [];
  page.on('request', (r) => { if (r.method() !== 'GET') calls.push(r.url()); });
  page.on('pageerror', (error) => console.error('Browser exception:', error.message));
  await page.goto(new URL('/resume', base).href);
  const upload = page.locator('input[type=file]');
  await upload.setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: pdf });
  const waitForEvidence = async (text) => {
    try {
      await page.waitForFunction((sample) => document.querySelector('#rs-evidence')?.value.includes(sample), text, { timeout: 30000 });
    } catch (error) {
      throw new Error('Import failed: ' + (await page.locator('.rs-status').allTextContents()).join(' '), { cause: error });
    }
  };
  await waitForEvidence('Browser PDF Resume Example');
  await upload.setInputFiles({ name: 'resume.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: createDocx('TypeScript Verified Evidence') });
  await waitForEvidence('TypeScript Verified Evidence');
  await page.getByText('從履歷與作品確認推薦技能', {exact: true}).click();
  await page.getByRole('button', {name:'加入 TypeScript',exact:true}).click();
  await page.getByRole('button', {name:'TypeScript 已在我的技能',exact:true}).waitFor();
  await page.locator('#rs-name').fill('Verification Example');
  await page.getByRole('button', { name: '用素材建立草稿' }).click();
  assert.match(await page.locator('#rs-draft').inputValue(), /Browser PDF Resume Example/);
  assert.match(await page.locator('#rs-draft').inputValue(), /TypeScript Verified Evidence/);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.rs-sheet').isVisible(), true);
  assert.equal(await page.locator('#rs-evidence').isVisible(), false);
  assert.match(await page.locator('.rs-sheet').innerText(), /Verification Example/);
  const printable = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  assert.equal(printable.subarray(0, 4).toString(), '%PDF');
  assert.equal(calls.some((url) => url.includes('/api/resume/generate') || url.includes('openrouter.ai')), false);
  await page.emulateMedia({media: 'screen'});
  await page.goto(base);
  await page.getByRole('searchbox').fill('不存在的工作-678910');
  await page.getByRole('heading',{name:'目前沒有符合條件的職缺'}).waitFor();
  await page.getByRole('button',{name:'顯示全部職缺'}).click();
  await page.goto(new URL('/?view=trends', base).href);
  await page.getByRole('button', {name: /^\d{4}-\d{2}$/}).first().click();
  await page.getByRole('heading',{name: /職缺依據/}).waitFor();
  await page.setViewportSize({width:375,height:800});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('Real PDF and DOCX imports, manual draft and print layout verified.');
} finally {
  await browser.close();
}
