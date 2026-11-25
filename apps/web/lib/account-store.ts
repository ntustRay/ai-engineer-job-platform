import type { Pool } from "pg";
import { applyChanges, emptyProfile, parseChanges, type EntryChange, type JobProfile } from "./account-model";

type ProfileQuery = { query(sql: string, parameters: unknown[]): Promise<{ rows: unknown[] }> };

export async function loadProfile(db: ProfileQuery, userId: string): Promise<JobProfile> {
  const { rows } = await db.query(
    "SELECT bucket, value, TRUE AS add FROM job_profile_entries WHERE user_id = $1 ORDER BY bucket, value",
    [userId],
  );
  // The database may legitimately contain more entries than one PATCH permits.
  const profile = emptyProfile();
  for (const row of rows) {
    const changes = parseChanges({ changes: [row] });
    if (changes) profile[changes[0].bucket].push(changes[0].value);
  }
  return profile;
}

export async function changeProfile(db: Pool, userId: string, changes: EntryChange[]): Promise<JobProfile> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const next = await applyProfileTransaction(client, userId, changes);
    await client.query("COMMIT");
    return next;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function applyProfileTransaction(db: ProfileQuery, userId: string, changes: EntryChange[]): Promise<JobProfile> {
  await db.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [userId]);
  const current = await loadProfile(db, userId);
  if (changes.length > 0) {
    const input = JSON.stringify(changes);
    await db.query(
      `DELETE FROM job_profile_entries e
       USING jsonb_to_recordset($2::jsonb) c(bucket text, value text, "add" boolean)
       WHERE e.user_id = $1 AND e.bucket = c.bucket AND e.value = c.value AND NOT c."add"`,
      [userId, input],
    );
    await db.query(
      `INSERT INTO job_profile_entries(user_id, bucket, value)
       SELECT $1, c.bucket, c.value FROM jsonb_to_recordset($2::jsonb) c(bucket text, value text, "add" boolean)
       WHERE c."add" ON CONFLICT DO NOTHING`,
      [userId, input],
    );
  }
  return applyChanges(current, changes);
}
