import { analyzeJob, type Job } from '@job/domain';
import snapshot from '../../../data/taiwanjobs-sample.json';
import { getDatabasePool } from './database';
import { belongsToCohort, comparablePeriods, matchesRequirement, type PeriodResult } from './market-filter';
import { marketHistorySql } from './market-sql';
import type { MarketData, MarketFilter, MarketHistory } from './market-types';

export type { HistoryPoint, MarketData, MarketHistory } from './market-types';

const sampleJobs: Job[] = snapshot.records.map((record) => ({
  ...record,
  source: 'taiwanjobs',
  id: 'taiwanjobs:' + record.sourceId,
  ...analyzeJob(record.title, record.description),
}));

const currentPageLimit = 500;

function taipeiDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

function sampleMarket(reason = ''): MarketData {
  const today = taipeiDate();
  const jobs = sampleJobs.filter((job) => job.expiresAt === null || job.expiresAt >= today);
  return {
    jobs,
    firstSeen: {},
    coverage: {
      mode: 'snapshot',
      updatedAt: snapshot.observedOn,
      source: snapshot.provider,
      sourceUrl: snapshot.catalog,
      degraded: Boolean(reason),
      note: reason + '顯示 ' + snapshot.observedOn + ' 擷取的官方職缺選樣。此批資料僅涵蓋部分職缺，實際開缺狀態請以原站為準。',
    },
  };
}

interface SyncHealth {
  updatedAt: Date | null;
  latestIssues: number;
}

const syncHealthSql = `
  SELECT (SELECT max(observed_at) FROM collector_runs WHERE status <> 'failed') AS "updatedAt",
         count(*) FILTER (WHERE status <> 'complete')::int AS "latestIssues"
  FROM (SELECT DISTINCT ON (scope_key) status FROM collector_runs
        ORDER BY scope_key, observed_at DESC, id DESC) AS latest
`;

export async function loadMarket(): Promise<MarketData> {
  if (!process.env.DATABASE_URL) return sampleMarket();
  try {
    const db = getDatabasePool();
    const [current, status] = await Promise.all([
      db.query<{ payload: Job; firstSeen: string }>(`
        SELECT payload, first_seen_on::text AS "firstSeen" FROM current_jobs WHERE active
        ORDER BY first_seen_on DESC, last_seen_on DESC, id LIMIT $1
      `, [currentPageLimit + 1]),
      db.query<SyncHealth>(syncHealthSql),
    ]);
    const health = status.rows[0];
    if (!health?.updatedAt) return sampleMarket('尚未取得成功的同步紀錄。');
    const records = current.rows.slice(0, currentPageLimit);
    const truncated = current.rows.length > currentPageLimit;
    return {
      jobs: records.map((row) => row.payload),
      firstSeen: Object.fromEntries(records.map((row) => [row.payload.id, row.firstSeen])),
      coverage: {
        mode: 'database',
        updatedAt: health.updatedAt.toISOString(),
        source: snapshot.provider,
        sourceUrl: snapshot.catalog,
        degraded: health.latestIssues > 0 || truncated,
        note: (health.latestIssues > 0 ? '部分範圍最近一次同步未完整，保留先前仍有效的觀測。' : '資料涵蓋已設定的同步範圍。')
          + (truncated ? '此頁顯示最近收錄的 500 筆；歷史趨勢採計所選範圍的完整觀測。' : ''),
      },
    };
  } catch {
    return sampleMarket('目前無法讀取資料庫。');
  }
}

export async function getCurrentJob(id: string): Promise<Job | null> {
  if (!id || id.length > 200) return null;
  if (process.env.DATABASE_URL) {
    try {
      const db = getDatabasePool();
      const result = await db.query<{ payload: Job }>(
        'SELECT payload FROM current_jobs WHERE id = $1 AND active', [id]);
      if (result.rows[0]) return result.rows[0].payload;
      if ((await db.query<SyncHealth>(syncHealthSql)).rows[0]?.updatedAt) return null;
    } catch {
      // Follow the same official sample shown by the dashboard during an outage.
    }
  }
  return sampleMarket().jobs.find((job) => job.id === id) ?? null;
}

function sampleHistory(filter: MarketFilter): MarketHistory {
  const period = snapshot.observedOn.slice(0, 7);
  const jobs = sampleJobs.filter((job) => belongsToCohort(job, filter));
  const matched = jobs.filter((job) => matchesRequirement(job, filter));
  const selected = period === filter.period;
  return {
    points: [{ period, total: jobs.length, matching: matched.length, observedDays: 1, complete: false, scopes: ['官方職缺選樣'] }],
    comparable: false,
    comparablePeriods: [],
    evidence: selected ? matched.slice(0, 12) : [],
    evidenceTotal: selected ? matched.length : 0,
    mode: 'snapshot',
  };
}

export async function getMarketHistory(filter: MarketFilter): Promise<MarketHistory> {
  if (!process.env.DATABASE_URL) return sampleHistory(filter);
  const db = getDatabasePool();
  const { rows } = await db.query<PeriodResult>(marketHistorySql,
    [filter.role, filter.skill, filter.kind, filter.location, filter.period]);
  if (rows.length === 0) {
    const health = (await db.query<SyncHealth>(syncHealthSql)).rows[0];
    if (!health?.updatedAt) return sampleHistory(filter);
  }
  const selected = rows.find((row) => row.period === filter.period);
  const consistent = comparablePeriods(rows);
  return {
    points: rows.map(({ period, total, matching, observedDays, complete, scopes }) =>
      ({ period, total, matching, observedDays, complete, scopes })),
    comparable: consistent.length > 1,
    comparablePeriods: consistent,
    evidence: selected?.evidence ?? [],
    evidenceTotal: selected?.matching ?? 0,
    mode: 'database',
  };
}
