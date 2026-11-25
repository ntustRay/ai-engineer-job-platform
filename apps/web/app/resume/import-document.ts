const MAX_BYTES = 6 * 1024 * 1024;
const MAX_EXTRACTED = 90000;

export async function importDocument(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('請選擇小於 6 MB 的檔案。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  let value = '';
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true });
    try {
      const document = await task.promise;
      if (document.numPages > 40) throw new Error('請選擇 40 頁以內的履歷，或直接貼上重點段落。');
      const pages: string[] = [];
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.flatMap((item) => 'str' in item ? [item.str + (item.hasEOL ? '\n' : ' ')] : []).join('');
        pages.push(text.trim());
        page.cleanup();
      }
      value = pages.join('\n\n');
    } finally {
      await task.destroy();
    }
  } else if (extension === 'docx') {
    const mammoth = await import('mammoth');
    value = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (extension === 'txt' || extension === 'md') {
    value = await file.text();
  } else {
    throw new Error('支援 PDF、DOCX、TXT 和 Markdown。');
  }
  const text = value.replace(/\u0000/g, '').trim();
  if (!text) throw new Error('檔案內沒有可讀取的文字。若是掃描檔，請直接貼上履歷文字。');
  if (text.length > MAX_EXTRACTED) throw new Error('檔案文字過長，請直接貼上要採用的經歷。');
  return text;
}
