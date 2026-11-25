import { z } from 'zod';
import { readLimitedText, reply, resumeAccount } from '../http';

const metaSchema = z.object({
  owner: z.object({ id: z.number() }), private: z.boolean(), full_name: z.string(),
  description: z.string().nullable(), language: z.string().nullable(), html_url: z.string().url(),
});

export async function GET(request: Request) {
  const account = await resumeAccount(request);
  if (account instanceof Response) return account;
  const name = new URL(request.url).searchParams.get('name') || '';
  const parts = /^([a-z\d-]{1,39})\/([a-z\d_.-]{1,100})$/i.exec(name);
  if (!parts || parts[2] === '.' || parts[2] === '..') return reply({ error: '請選擇有效的 GitHub 專案。' }, 400);
  if (!account.user.githubId) return reply({ error: '這個帳號尚未連結 GitHub。' }, 403);
  const url = `https://api.github.com/repos/${parts[1]}/${parts[2]}`;
  const options = { cache: 'no-store' as const, headers: { 'User-Agent': 'role-atlas', Accept: 'application/vnd.github+json' } };
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return reply({ error: '找不到公開專案。' }, 404);
    if (!response.ok) return reply({ error: 'GitHub 目前無法提供資料，請稍後再試。' }, 502);
    const meta = metaSchema.parse(await response.json());
    if (meta.private || String(meta.owner.id) !== String(account.user.githubId)) return reply({ error: '請選擇自己帳號的公開專案。' }, 403);
    const readme = await fetch(url + '/readme', {
      ...options, signal: AbortSignal.timeout(8000), headers: { ...options.headers, Accept: 'application/vnd.github.raw+json' },
    });
    if (!readme.ok && readme.status !== 404) return reply({ error: 'GitHub 無法讀取 README，請稍後重試或貼上作品摘要。' }, 502);
    const markdown = readme.ok ? await readLimitedText(readme, 512000) : '';
    const sample = markdown.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 2400);
    const evidence = [meta.full_name, meta.html_url, meta.description, meta.language && `主要語言：${meta.language}`, sample].filter(Boolean).join('\n');
    return reply({ evidence });
  } catch {
    return reply({ error: '專案資料過大或 GitHub 未回應，請手動貼上要引用的作品段落。' }, 502);
  }
}
