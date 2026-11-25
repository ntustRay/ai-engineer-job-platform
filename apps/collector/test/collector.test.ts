import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { migration, saveObservation, type Query } from "../src/store";
import { feedUrl, parseCsv, readFeed, type Scope } from "../src/taiwanjobs";

const scope: Scope = { key: "taiwanjobs:01:0802", city: "台北市", cityCode: "01", occupation: "0802" };
const header = "OCCU_DESC（職務名稱）,COMPNAME,CITYNAME,URL_QUERY（職缺資料URL）,JOB_DETAIL,CJOB2_COUNT,TRANDATE,STOP_DATE";
function listing(id: number, description = "熟悉 React 和 TypeScript。", location = "臺北市中山區") {
  const values = ["前端軟體工程師", "測試用公司", location,
    "https://job.taiwanjobs.gov.tw/Internet/jobwanted/JobDetail.aspx?EMPLOYER_ID=1&HIRE_ID=" + id,
    description, "080203", "20260124", "20991231"];
  return values.map(value => '"' + value.replaceAll('"', '""') + '"').join(", ");
}
function snapshot(day: string, lines: string[]) {
  return readFeed([header,...lines].join("\r\n"), scope, day);
}

test("multiline jobs, escaped quotes, embedded comma, stable identity & duplicate postings", () => {
  const description = '使用 React, TypeScript。\r\n熟悉 "CI/CD" 加分。';
  const result = snapshot("2026-01-01T18:00:00Z", [listing(1,description), listing(1,description)]);
  expect(result.status).toBe("complete");
  expect(result.rowCount).toBe(2);
  expect(result.jobs).toHaveLength(1);
  expect(result.jobs[0]).toMatchObject({ id: "taiwanjobs:1", description, expiresAt: "2099-12-31", updatedAt: "2026-01-24" });
  expect(feedUrl(scope).searchParams.get("jobno")).toBe("0802");
  expect(() => parseCsv('"open field')).toThrow();
  expect(() => readFeed("<html>error</html>",scope,result.observedAt)).toThrow();
});

test("incomplete, capped or incorrectly filtered feeds cannot close other postings", () => {
  expect(snapshot("2026-01-01", []).status).toBe("partial");
  expect(snapshot("2026-01-01", [listing(1),listing(2,"X","高雄市")]).status).toBe("partial");
  const repeated = Array<string>(1000).fill(listing(1));
  expect(snapshot("2026-01-01", repeated).status).toBe("capped");
});

const db = new PGlite();
const query: Query = (sql, params) => db.query(sql, params);
beforeAll(async () => { await db.exec(await migration()); });
afterAll(async () => { await db.close(); });

test("SQL retains changed and reverted content, dedupes retries, and orders backfills by observation", async () => {
  const first = snapshot("2026-01-01T18:00:00Z", [listing(1),listing(2)]);
  expect(await saveObservation(query, first)).toBe(true);
  expect(await saveObservation(query, first)).toBe(false);
  const later = snapshot("2026-01-06T00:00:00Z", [listing(1)]);
  await saveObservation(query, later);
  const changed = snapshot("2026-01-03T00:00:00Z", [listing(1,"需要 React & Kubernetes。")]);
  await saveObservation(query, changed);
  await saveObservation(query, { ...later, scopeKey: scope.key, observedAt:"2026-01-07T00:00:00Z", status:"failed", jobs:[], rowCount:0 });
  await saveObservation(query, { ...later, observedAt:"2026-01-08T00:00:00Z", status:"capped", jobs:[],rowCount:1000 });
  const history = await db.query<{ description: string; day: string }>(`
    SELECT v.payload->>'description' AS description, r.observed_on::text AS day
    FROM job_observations o JOIN collector_runs r ON r.id=o.run_id
    JOIN job_versions v ON v.id=o.version_id WHERE o.job_id='taiwanjobs:1' ORDER BY observed_at`);
  expect(history.rows.map(r=>r.description)).toEqual([first.jobs[0]?.description,changed.jobs[0]?.description,later.jobs[0]?.description]);
  expect(history.rows[0]?.day).toBe("2026-01-02");
  expect((await db.query("SELECT id FROM job_versions")).rows).toHaveLength(3);
  expect((await db.query("SELECT id,active FROM current_jobs ORDER BY id")).rows).toEqual([
    {id:"taiwanjobs:1",active:true},{id:"taiwanjobs:2",active:false},
  ]);
  const reappeared = snapshot("2026-01-09T00:00:00Z", [listing(2)]);
  await saveObservation(query, { ...reappeared, status:"partial" });
  expect((await db.query("SELECT id FROM current_jobs WHERE active")).rows).toHaveLength(2);
});
