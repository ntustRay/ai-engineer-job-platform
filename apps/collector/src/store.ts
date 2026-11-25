import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { RULES_VERSION } from "@job/domain";
import type { Observation } from "./taiwanjobs";

export const migration = () => readFile(new URL("../migrations/001_collector.sql", import.meta.url), "utf8");

export type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

/** Caller supplies a dedicated connection (the transaction is never spread across pool clients). */
export async function saveObservation(query: Query, observation: Observation) {
  const { scopeKey, observedAt, status, rowCount, jobs, error } = observation;
  await query("BEGIN");
  try {
    const run = await query(`
      INSERT INTO collector_runs(scope_key,observed_at,observed_on,status,row_count,valid_count,error)
      VALUES ($1,$2,($2::timestamptz AT TIME ZONE 'Asia/Taipei')::date,$3,$4,$5,$6)
      ON CONFLICT (scope_key,observed_at) DO NOTHING RETURNING id`,
      [scopeKey, observedAt, status, rowCount, jobs.length, error]);
    const runId = run.rows[0]?.id;
    if (runId != null && jobs.length > 0) {
      const records = JSON.stringify(jobs.map(job => ({
        id: job.id,
        hash: createHash("sha256").update(JSON.stringify(job)).digest("hex"),
        payload: job,
      })));
      await query(`
        INSERT INTO jobs(id,source,source_id,first_seen_on,last_seen_on)
        SELECT j.id,j.payload->>'source',j.payload->>'sourceId',r.observed_on,r.observed_on
        FROM jsonb_to_recordset($1::jsonb) j(id text,payload jsonb)
        JOIN collector_runs r ON r.id=$2 ORDER BY j.id
        ON CONFLICT(id) DO UPDATE SET
          first_seen_on=least(jobs.first_seen_on,excluded.first_seen_on),
          last_seen_on=greatest(jobs.last_seen_on,excluded.last_seen_on)`, [records,runId]);
      await query(`
        INSERT INTO job_versions(job_id,content_hash,rules_version,payload)
        SELECT j.id,j.hash,$2,j.payload FROM jsonb_to_recordset($1::jsonb)
          j(id text,hash text,payload jsonb) ORDER BY j.id
        ON CONFLICT(job_id,content_hash,rules_version) DO NOTHING`, [records,String(RULES_VERSION)]);
      await query(`
        INSERT INTO job_observations(run_id,job_id,version_id)
        SELECT $2,j.id,v.id FROM jsonb_to_recordset($1::jsonb) j(id text,hash text)
        JOIN job_versions v ON v.job_id=j.id AND v.content_hash=j.hash AND v.rules_version=$3`,
        [records,runId,String(RULES_VERSION)]);
    }
    await query("COMMIT");
    return runId != null;
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}
