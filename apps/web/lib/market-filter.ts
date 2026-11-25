import { ROLE_LABELS, SKILLS, type Job } from '@job/domain';
import type { HistoryPoint, MarketFilter } from './market-types';

export function parseMarketFilter(params: URLSearchParams): MarketFilter | null {
  const role = params.get('role') || null;
  const skill = params.get('skill') || null;
  const kind = params.get('kind') || null;
  const location = params.get('location')?.trim() || null;
  const period = params.get('period') || null;
  if (role && !Object.hasOwn(ROLE_LABELS, role)) return null;
  if (skill && !SKILLS.some((entry) => entry.id === skill)) return null;
  if (kind !== null && kind !== 'required' && kind !== 'preferred' && kind !== 'mentioned') return null;
  if (location && location.length > 60) return null;
  if (period && !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) return null;
  return { role, skill, kind, location, period };
}

function normalizePlace(place: string) {
  return place.toLowerCase().replaceAll('臺', '台');
}

export function belongsToCohort(job: Job, filter: MarketFilter): boolean {
  return (!filter.role || job.role === filter.role)
    && (!filter.location || normalizePlace(job.location).includes(normalizePlace(filter.location)));
}

export function matchesRequirement(job: Job, filter: MarketFilter): boolean {
  if (!filter.skill && !filter.kind) return true;
  return job.requirements.some((requirement) =>
    (!filter.kind || requirement.kind === filter.kind)
    && (!filter.skill || requirement.skillIds.includes(filter.skill)));
}

export interface PeriodResult extends HistoryPoint {
  ruleVersions: string[];
  evidence: Job[];
}

function sameCoverage(previous: PeriodResult, current: PeriodResult): boolean {
  const next = new Date(previous.period + '-01T00:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  return current.complete && previous.complete && previous.total > 0 && current.total > 0
    && next.toISOString().slice(0, 7) === current.period
    && JSON.stringify(current.scopes) === JSON.stringify(previous.scopes)
    && current.ruleVersions.length === 1 && previous.ruleVersions.length === 1
    && current.ruleVersions[0] === previous.ruleVersions[0];
}

/** A new partial month does not invalidate earlier, fully observed comparisons. */
export function comparablePeriods(rows: readonly PeriodResult[]): string[] {
  for (let end = rows.length - 1; end > 0; end--) {
    if (!sameCoverage(rows[end - 1], rows[end])) continue;
    let start = end - 1;
    while (start > 0 && sameCoverage(rows[start - 1], rows[start])) start--;
    return rows.slice(start, end + 1).map((point) => point.period);
  }
  return [];
}
