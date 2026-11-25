import { betterAuth } from "better-auth";
import { getDatabasePool } from "./database";
export { getDatabasePool as getAccountPool } from "./database";

function createAuth() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!process.env.DATABASE_URL || !clientId || !clientSecret || !secret || !baseURL) return null;

  return betterAuth({
    appName: "職域圖譜",
    baseURL,
    secret,
    database: getDatabasePool(),
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: { clientId, clientSecret, disableDefaultScope: true, scope: ["user:email"] },
    },
    account: { updateAccountOnSignIn: false, accountLinking: { enabled: false } },
    databaseHooks: {
      account: {
        create: { before: async () => ({ data: { accessToken: null, refreshToken: null, idToken: null } }) },
        update: { before: async () => ({ data: { accessToken: null, refreshToken: null, idToken: null } }) },
      },
    },
  });
}

let auth: ReturnType<typeof createAuth>;
export function getAuth() {
  return auth ??= createAuth();
}

export type AccountContext =
  | { status: "unavailable" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: { id: string; name: string; githubId: string | null } };

export async function getAccountContext(requestHeaders: Headers): Promise<AccountContext> {
  const configured = getAuth();
  if (!configured) return { status: "unavailable" };
  const session = await configured.api.getSession({ headers: requestHeaders });
  if (!session) return { status: "anonymous" };
  const { rows } = await getDatabasePool().query<{ accountId: string }>(
    'SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [session.user.id, "github"],
  );
  return {
    status: "authenticated",
    user: { id: session.user.id, name: session.user.name, githubId: rows[0]?.accountId ?? null },
  };
}
