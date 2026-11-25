import type { Job, Requirement } from "./model";
import { expandSkills } from "./skills";

export interface MatchResult {
  matched: Requirement[];
  missing: Requirement[];
  preferred: Requirement[];
  mentions: Requirement[];
  /** A ranking heuristic; not an applicant's probability of being hired. */
  score: number;
  meetsKnownRequirements: boolean;
}

export function matchJob(job: Pick<Job, "requirements">, skillIds: readonly string[]): MatchResult {
  const known = expandSkills(skillIds);
  const matched: Requirement[] = [];
  const missing: Requirement[] = [];
  const preferred: Requirement[] = [];
  const mentions: Requirement[] = [];
  for (const requirement of job.requirements) {
    const satisfies = requirement.skillIds.some((id) => known.has(id));
    if (requirement.kind === "required") {
      (satisfies ? matched : missing).push(requirement);
    } else if (satisfies && requirement.kind === "preferred") {
      preferred.push(requirement);
    } else if (satisfies) {
      mentions.push(requirement);
    }
  }
  const totalRequired = matched.length + missing.length;
  const requiredScore = totalRequired ? (matched.length / totalRequired) * 80 : 0;
  const score = Math.round(requiredScore + Math.min(15, preferred.length * 5) + Math.min(5, mentions.length));
  return { matched, missing, preferred, mentions, score, meetsKnownRequirements: totalRequired > 0 && missing.length === 0 };
}

export function skillGains(jobs: readonly Job[], skillIds: readonly string[]) {
  const result = new Map<string, Set<string>>();
  for (const job of jobs) {
    const { missing } = matchJob(job, skillIds);
    if (!missing.length) continue;
    // Consider skills expressly named by this job. A candidate might cover two
    // missing groups with the same skill (e.g. Vitest plus unit testing).
    const candidates = new Set(missing.flatMap((group) => group.skillIds));
    for (const skillId of candidates) {
      const added = expandSkills([skillId]);
      if (!missing.every((group) => group.skillIds.some((id) => added.has(id)))) continue;
      const jobIds = result.get(skillId) ?? new Set<string>();
      jobIds.add(job.id);
      result.set(skillId, jobIds);
    }
  }
  return [...result].map(([skillId, ids]) => ({ skillId, jobIds: [...ids].sort() }))
    .sort((a, b) => b.jobIds.length - a.jobIds.length || a.skillId.localeCompare(b.skillId));
}
