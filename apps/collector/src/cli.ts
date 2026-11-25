import { writeFile } from "node:fs/promises";
import pg from "pg";
import { fetchScope, scopes, type Observation } from "./taiwanjobs";
import { migration, saveObservation } from "./store";

async function run() {
  const command = process.argv[2];
  if (!["probe", "migrate", "collect"].includes(command ?? "")) {
    throw new Error("Usage: bun src/cli.ts migrate | collect | probe [--output file.json]");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (command !== "probe" && !databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = command === "probe" ? null : new pg.Pool({
    connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 15_000,
  });
  try {
    if (command === "migrate" && pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(19041101)");
        await client.query(await migration());
        await client.query("COMMIT");
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
      console.log("Collector schema ready");
      return;
    }
    const observations: Observation[] = [];
    for (const scope of scopes) {
      let observed = await fetchScope(scope);
      if (observed.status === "failed") observed = await fetchScope(scope);
      if (pool) {
        const client = await pool.connect();
        try { await saveObservation((sql, params) => client.query(sql, params), observed); }
        finally { client.release(); }
      }
      observations.push(observed);
      console.log(JSON.stringify({
        scope: scope.key, observedAt: observed.observedAt, status: observed.status,
        rows: observed.rowCount, jobs: observed.jobs.length, error: observed.error,
      }));
    }
    const outputFlag = process.argv.indexOf("--output");
    if (outputFlag !== -1) {
      const file = process.argv[outputFlag + 1];
      if (!file) throw new Error("Expected path after --output");
      await writeFile(file, JSON.stringify({ observations }, null, 2), "utf8");
    }
    if (observations.some(r => r.status === "failed") || observations.every(r => r.jobs.length === 0)) {
      process.exitCode = 1;
    }
  } finally {
    await pool?.end();
  }
}

run().catch((error: unknown) => {
  // Database errors may contain credentials in their connection string.
  // Only show the PostgreSQL error code to the public workflow log.
  const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database]") : "Collector failed";
  console.error(message);
  process.exitCode = 1;
});
