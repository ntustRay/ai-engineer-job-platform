import type { Job } from '@job/domain';

export interface MarketData {
  jobs: Job[];
  firstSeen: Record<string, string>;
  coverage: {
    mode: 'database' | 'snapshot';
    updatedAt: string | null;
    source: string;
    sourceUrl: string;
    note: string;
    degraded: boolean;
  };
}

export interface HistoryPoint {
  period: string;
  total: number;
  matching: number;
  observedDays: number;
  complete: boolean;
  scopes: string[];
}

export interface MarketHistory {
  points: HistoryPoint[];
  comparable: boolean;
  comparablePeriods: string[];
  evidence: Job[];
  evidenceTotal: number;
  mode: 'database' | 'snapshot';
}

export interface MarketFilter {
  role: string | null;
  skill: string | null;
  kind: 'required' | 'preferred' | 'mentioned' | null;
  location: string | null;
  period: string | null;
}
