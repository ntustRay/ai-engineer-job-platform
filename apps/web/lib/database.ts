import { Pool } from "pg";

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  return pool ??= new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000 });
}
