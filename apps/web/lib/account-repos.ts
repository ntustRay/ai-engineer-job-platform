export type PublicRepo = {
  id: number;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
};

type RecordData = Record<string, unknown>;
function record(data: unknown): data is RecordData {
  return !!data && typeof data === "object" && !Array.isArray(data);
}

export function isPublicRepo(input: unknown): input is PublicRepo {
  return record(input) && typeof input.id === "number" && typeof input.fullName === "string"
    && typeof input.url === "string" && (input.description === null || typeof input.description === "string")
    && (input.language === null || typeof input.language === "string");
}

export function readRepo(input: unknown, githubId: string): PublicRepo | null {
  if (!record(input) || input.private !== false || !record(input.owner) || String(input.owner.id) !== githubId) return null;
  if (typeof input.id !== "number" || typeof input.full_name !== "string") return null;
  if (!/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(input.full_name)) return null;
  return {
    id: input.id, fullName: input.full_name, url: "https://github.com/" + input.full_name,
    description: typeof input.description === "string" ? input.description : null,
    language: typeof input.language === "string" ? input.language : null,
  };
}

export async function listPublicRepos(githubId: string, page: number) {
  const get = (path: string) => fetch("https://api.github.com" + path, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "ai-engineer-job-platform" },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!/^\d+$/.test(githubId)) throw new Error("Invalid GitHub account.");
  const userResponse = await get("/user/" + githubId);
  if (!userResponse.ok) throw new Error("GitHub profile unavailable.");
  const user: unknown = await userResponse.json();
  if (!record(user) || String(user.id) !== githubId || typeof user.login !== "string" || !/^[a-z\d-]+$/i.test(user.login)) {
    throw new Error("GitHub profile unavailable.");
  }
  const response = await get(`/users/${user.login}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
  if (!response.ok) throw new Error("GitHub repositories unavailable.");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("GitHub repositories unavailable.");
  const repos = data.map((entry) => readRepo(entry, githubId)).filter((repo) => repo !== null);
  const complete = !response.headers.get("link")?.includes('rel="next"');
  return { repos, complete, nextPage: complete ? null : page + 1 };
}
