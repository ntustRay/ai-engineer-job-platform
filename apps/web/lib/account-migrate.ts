import { getMigrations } from "better-auth/db/migration";
import { getDatabasePool } from "./database";
import { readFile } from "node:fs/promises";

const pool = getDatabasePool();
try {
  const { runMigrations } = await getMigrations({ database: pool });
  await runMigrations();
  await pool.query(await readFile(new URL("./account-schema.sql", import.meta.url), "utf8"));
  console.log("Account schema ready.");
} finally {
  await pool.end();
}
