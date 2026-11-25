import { getAuth } from "../../../../lib/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(request: Request) {
  const auth = getAuth();
  if (!auth) return Response.json({ error: "尚未設定 GitHub 登入服務。" }, { status: 503 });
  return auth.handler(request);
}

export { handle as GET, handle as POST };
