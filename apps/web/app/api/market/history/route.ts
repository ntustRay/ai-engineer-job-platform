import { getMarketHistory } from '../../../../lib/market';
import { parseMarketFilter } from '../../../../lib/market-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const filter = parseMarketFilter(new URL(request.url).searchParams);
  if (!filter) return Response.json({ error: '職類、技能、地區或月份格式不正確。' }, { status: 400 });
  try {
    const result = await getMarketHistory(filter);
    return Response.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return Response.json({ error: '目前無法取得歷史觀測，請稍後再試。' }, { status: 503 });
  }
}
