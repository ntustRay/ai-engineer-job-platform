import { getAccountContext } from "../../../../lib/account";
import { listPublicRepos } from "../../../../lib/account-repos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1) return json({ error: "頁碼無效。" }, 400);
  try {
    const context = await getAccountContext(request.headers);
    if (context.status !== "authenticated") return json({ error: "請先登入 GitHub。" }, context.status === "anonymous" ? 401 : 503);
    if (!context.user.githubId) return json({ error: "找不到已連結的 GitHub 帳號。" }, 409);
    return json(await listPublicRepos(context.user.githubId, page));
  } catch {
    return json({ error: "GitHub 暫時無法回傳作品，請稍後重試。" }, 503);
  }
}
