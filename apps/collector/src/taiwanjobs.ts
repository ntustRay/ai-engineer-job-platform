import { analyzeJob, type Job } from "@job/domain";
import { z } from "zod";

export const SOURCE = "taiwanjobs";
export const ROW_LIMIT = 1000;
export const ENDPOINT = "https://free.taiwanjobs.gov.tw/WebService_Taipei/Webservice.ashx";
export type RunStatus = "complete" | "partial" | "capped" | "failed";
export interface Scope { key: string; city: string; cityCode: string; occupation: string }
export interface Observation {
  scopeKey: string; observedAt: string; status: RunStatus; rowCount: number;
  jobs: Job[]; error: string | null;
}

export const scopes: Scope[] = [
  { cityCode: "01", city: "台北市" }, { cityCode: "31", city: "新北市" },
].flatMap(city => ["0801", "0802", "0803"].map(occupation => ({
  ...city, occupation, key: `taiwanjobs:${city.cityCode}:${occupation}`,
})));

export function feedUrl(scope: Scope) {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    city: scope.cityCode, jobno: scope.occupation, count: String(ROW_LIMIT), T: "CSV",
  }).toString();
  return url;
}

// The official CSV encloses fields in quotes and may insert spaces after commas.
// Line breaks inside the job description are data, not record separators.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; afterQuote = true; }
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(field.trim());
      field = ""; afterQuote = false;
      if (c !== ",") {
        if (row.some(value => value.length > 0)) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
      continue;
    }
    if (afterQuote && c.trim()) throw new Error("Invalid characters after CSV quote");
    if (c === '"' && !field.trim() && !afterQuote) { field = ""; quoted = true; }
    else field += c;
  }
  if (quoted) throw new Error("Truncated CSV quoted field");
  row.push(field.trim());
  if (row.some(value => value.length > 0)) rows.push(row);
  return rows;
}

const rowSchema = z.object({
  OCCU_DESC: z.string().trim().min(1),
  JOB_DETAIL: z.string().trim().min(1),
  COMPNAME: z.string().trim().min(1),
  CITYNAME: z.string().trim().min(1),
  URL_QUERY: z.string().trim().url(),
  CJOB2_COUNT: z.string().optional(),
  STOP_DATE: z.string().optional(),
  TRANDATE: z.string().optional(),
});

function dateOrNull(raw: string | undefined) {
  if (!raw || raw.trim() === "-") return null;
  const clean = raw.trim().replaceAll("/", "").replaceAll("-", "");
  if (!/^\d{8}$/.test(clean)) return null;
  const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6)}`;
  const parsed = new Date(iso + "T00:00:00Z");
  return Number.isFinite(+parsed) && parsed.toISOString().startsWith(iso) ? iso : null;
}

function normalizeRow(values: Record<string, string>, scope: Scope): Job | null {
  const parsed = rowSchema.safeParse(values);
  if (!parsed.success) return null;
  const row = parsed.data;
  if (!row.CITYNAME.replaceAll("臺", "台").includes(scope.city)
      || !row.CJOB2_COUNT?.startsWith(scope.occupation)) return null;
  const url = new URL(row.URL_QUERY.replaceAll("&amp;", "&"));
  if (url.hostname !== "job.taiwanjobs.gov.tw" || !["https:", "http:"].includes(url.protocol)) return null;
  url.protocol = "https:";
  let sourceId: string | null = null;
  for (const [key, value] of url.searchParams) if (key.toUpperCase() === "HIRE_ID") sourceId = value;
  if (!sourceId || !/^\d+$/.test(sourceId)) return null;
  return {
    id: SOURCE + ":" + sourceId, source: SOURCE, sourceId, title: row.OCCU_DESC,
    company: row.COMPNAME, location: row.CITYNAME, description: row.JOB_DETAIL,
    url: url.href, updatedAt: dateOrNull(row.TRANDATE), expiresAt: dateOrNull(row.STOP_DATE),
    ...analyzeJob(row.OCCU_DESC, row.JOB_DETAIL),
  };
}

export function readFeed(csv: string, scope: Scope, observedAt: string): Observation {
  const [rawHeaders, ...rows] = parseCsv(csv);
  const headers = rawHeaders?.map(value => value.replace(/^\uFEFF/, "").trim().match(/^[\w]+/)?.[0]?.toUpperCase() || "");
  if (!headers?.includes("OCCU_DESC") || !headers.includes("URL_QUERY")
      || !headers.includes("CJOB2_COUNT") || !headers.includes("JOB_DETAIL")) {
    throw new Error("Unrecognized TaiwanJobs CSV header");
  }
  const byId = new Map<string, Job>();
  let invalid = 0;
  for (const fields of rows) {
    if (fields.length !== headers.length) { invalid++; continue; }
    const record = Object.fromEntries(headers.map((field, i) => [field, fields[i] ?? ""]));
    const job = normalizeRow(record, scope);
    if (!job) { invalid++; continue; }
    const previous = byId.get(job.id);
    if (!previous || (job.updatedAt ?? "") > (previous.updatedAt ?? "")) byId.set(job.id, job);
  }
  // A header-only service response can be an upstream incident. Avoid withdrawing all jobs.
  const status = rows.length >= ROW_LIMIT ? "capped"
    : invalid > 0 || rows.length === 0 ? "partial" : "complete";
  const error = invalid ? `${invalid} row(s) invalid or outside the requested scope`
    : rows.length === 0 ? "Empty feed; coverage unconfirmed" : null;
  return { scopeKey: scope.key, observedAt, status, rowCount: rows.length, jobs: [...byId.values()], error };
}

export async function fetchScope(scope: Scope, observedAt = new Date().toISOString()): Promise<Observation> {
  try {
    const response = await fetch(feedUrl(scope), { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`TaiwanJobs HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    let csv: string;
    try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { csv = new TextDecoder("big5", { fatal: true }).decode(bytes); }
    return readFeed(csv, scope, observedAt);
  } catch (error) {
    return { scopeKey: scope.key, observedAt, status: "failed", rowCount: 0, jobs: [],
      error: error instanceof Error ? error.message : "TaiwanJobs fetch failed" };
  }
}
