import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, test } from 'bun:test';
import { marketHistorySql } from './market-sql';

test('monthly evidence deduplicates overlapping scopes, ignores failed retries and respects requirement kind', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../../collector/migrations/001_collector.sql', import.meta.url), 'utf8'));
    await db.exec(`
      INSERT INTO collector_runs(scope_key, observed_at, observed_on, status, row_count, valid_count) VALUES
        ('north', now() - INTERVAL '2 hours', current_date, 'complete', 2, 2),
        ('north', now(), current_date, 'failed', 0, 0),
        ('city', now() - INTERVAL '1 hour', current_date, 'capped', 1, 1);
      INSERT INTO jobs VALUES ('a','site','a',current_date,current_date),('b','site','b',current_date,current_date);
      INSERT INTO job_versions(job_id,content_hash,rules_version,payload) VALUES
        ('a','1','v1','{"id":"a","role":"frontend","location":"臺北市","requirements":[{"kind":"preferred","skillIds":["k8s"]}]}'),
        ('b','2','v1','{"id":"b","role":"frontend","location":"台北市","requirements":[{"kind":"required","skillIds":["k8s"]}]}');
      INSERT INTO job_observations VALUES (1,'a',1),(1,'b',2),(3,'b',2);
    `);
    const month = (await db.query<{ value: string }>("SELECT to_char(current_date,'YYYY-MM') AS value")).rows[0].value;
    const rows = (await db.query(marketHistorySql, ['frontend', 'k8s', 'required', '台北', month])).rows;
    expect(rows).toEqual([{
      period: month, total: 2, matching: 1, scopes: ['city', 'north'],
      observedDays: 1, complete: false, ruleVersions: ['v1'],
      evidence: [{ id: 'b', role: 'frontend', location: '台北市', requirements: [{ kind: 'required', skillIds: ['k8s'] }] }],
    }]);
  } finally {
    await db.close();
  }
}, 30000);
