export type JobProfile = {
  skills: string[];
  favorites: string[];
  applied: string[];
  selectedRepos: string[];
};

export const profileKeys = ["skills", "favorites", "applied", "selectedRepos"] as const;
export type ProfileKey = (typeof profileKeys)[number];
export const emptyProfile = (): JobProfile => ({ skills: [], favorites: [], applied: [], selectedRepos: [] });
export type EntryChange = { bucket: ProfileKey; value: string; add: boolean };

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isBucket(input: unknown): input is ProfileKey {
  return profileKeys.some((key) => key === input);
}

function isEntry(input: unknown): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= 256 && !/[\u0000-\u001f]/.test(input);
}

export function parseProfile(input: unknown): JobProfile | null {
  if (!isRecord(input)) return null;
  const result = emptyProfile();
  for (const key of profileKeys) {
    const values = input[key];
    if (!Array.isArray(values) || !values.every(isEntry)) return null;
    result[key] = [...new Set(values)];
  }
  return result;
}

export function parseChanges(input: unknown): EntryChange[] | null {
  if (!isRecord(input) || !Array.isArray(input.changes) || input.changes.length > 512) return null;
  const changes: EntryChange[] = [];
  const seen = new Set<string>();
  for (const entry of input.changes) {
    if (!isRecord(entry) || !isBucket(entry.bucket) || !isEntry(entry.value) || typeof entry.add !== "boolean") return null;
    const id = JSON.stringify([entry.bucket, entry.value]);
    if (seen.has(id)) return null;
    seen.add(id);
    changes.push({ bucket: entry.bucket, value: entry.value, add: entry.add });
  }
  return changes;
}

export function diffProfile(previous: JobProfile, patch: Partial<JobProfile>): EntryChange[] {
  const changes: EntryChange[] = [];
  for (const bucket of profileKeys) {
    const replacement = patch[bucket];
    if (!replacement) continue;
    const before = new Set(previous[bucket]);
    const after = new Set(replacement);
    for (const value of before) if (!after.has(value)) changes.push({ bucket, value, add: false });
    for (const value of after) if (!before.has(value)) changes.push({ bucket, value, add: true });
  }
  return changes;
}

export function applyChanges(profile: JobProfile, changes: readonly EntryChange[]): JobProfile {
  const next = { ...profile };
  for (const key of profileKeys) {
    const entries = new Set(next[key]);
    for (const change of changes) {
      if (change.bucket !== key) continue;
      if (change.add) entries.add(change.value);
      else entries.delete(change.value);
    }
    next[key] = [...entries];
  }
  return next;
}
