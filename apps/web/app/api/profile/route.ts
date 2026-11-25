import { getAccountContext, getAccountPool } from "../../../lib/account";
import { parseChanges } from "../../../lib/account-model";
import { changeProfile, loadProfile } from "../../../lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const context = await getAccountContext(request.headers);
    if (context.status !== "authenticated") return json({ status: context.status, profile: null });
    return json({ status: context.status, user: { id: context.user.id, name: context.user.name }, profile: await loadProfile(getAccountPool(), context.user.id) });
  } catch {
    return json({ error: "目前無法讀取帳號設定，請稍後重試。" }, 503);
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.BETTER_AUTH_URL || request.url).origin) return json({ error: "請從本站操作。" }, 403);
  try {
    const context = await getAccountContext(request.headers);
    if (context.status !== "authenticated") return json({ error: "請先登入。" }, context.status === "anonymous" ? 401 : 503);
    const body = await request.json().catch(() => null);
    if (body?.owner !== context.user.id) return json({ error: "登入帳號已變更，請重新整理。" }, 409);
    const changes = parseChanges(body);
    if (!changes) return json({ error: "設定內容無法辨識。" }, 400);
    const profile = await changeProfile(getAccountPool(), context.user.id, changes);
    return json({ profile });
  } catch {
    return json({ error: "設定尚未儲存，請稍後重試。" }, 503);
  }
}
