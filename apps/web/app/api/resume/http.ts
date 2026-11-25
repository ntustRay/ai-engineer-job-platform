import { getAccountContext } from '../../../lib/account';

export function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function resumeAccount(request: Request) {
  const ctx = await getAccountContext(request.headers).catch(() => ({ status: 'unavailable' as const }));
  if (ctx.status === 'unavailable') return reply({ error: '目前無法使用 GitHub 登入。仍可手動編輯、列印履歷。' }, 503);
  if (ctx.status !== 'authenticated') return reply({ error: '請先登入 GitHub，再使用帳號專屬功能。' }, 401);
  return ctx;
}

export async function readLimitedText(response: Request | Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('too large');
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let contents = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return contents + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('too large'); }
      contents += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
