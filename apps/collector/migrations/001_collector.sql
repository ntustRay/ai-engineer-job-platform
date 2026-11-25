CREATE TABLE IF NOT EXISTS collector_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_key text NOT NULL,
  observed_at timestamptz NOT NULL,
  observed_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('complete','capped','partial','failed')),
  row_count integer NOT NULL CHECK (row_count >= 0),
  valid_count integer NOT NULL CHECK (valid_count BETWEEN 0 AND row_count),
  error text,
  UNIQUE (scope_key, observed_at)
);
CREATE INDEX IF NOT EXISTS collector_runs_day ON collector_runs (observed_on, scope_key);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  first_seen_on date NOT NULL,
  last_seen_on date NOT NULL,
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS job_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  content_hash text NOT NULL,
  rules_version text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, content_hash, rules_version),
  UNIQUE (job_id, id)
);

CREATE TABLE IF NOT EXISTS job_observations (
  run_id bigint NOT NULL REFERENCES collector_runs(id),
  job_id text NOT NULL,
  version_id bigint NOT NULL,
  PRIMARY KEY (run_id, job_id),
  FOREIGN KEY (job_id, version_id) REFERENCES job_versions(job_id, id)
);
CREATE INDEX IF NOT EXISTS observations_by_job ON job_observations (job_id, run_id);

CREATE OR REPLACE VIEW current_jobs AS
WITH last_complete AS (
  SELECT scope_key, max(observed_at) AS observed_at FROM collector_runs
  WHERE status = 'complete' GROUP BY scope_key
), seen_in_scope AS (
  SELECT o.job_id, r.scope_key, max(r.observed_at) AS last_seen
  FROM job_observations o JOIN collector_runs r ON r.id = o.run_id
  GROUP BY o.job_id, r.scope_key
), presence AS (
  SELECT s.job_id, bool_or(c.observed_at IS NULL OR s.last_seen >= c.observed_at) AS active
  FROM seen_in_scope s LEFT JOIN last_complete c USING (scope_key) GROUP BY s.job_id
), latest AS (
  SELECT DISTINCT ON (o.job_id) o.job_id, o.version_id
  FROM job_observations o JOIN collector_runs r ON r.id = o.run_id
  ORDER BY o.job_id, r.observed_at DESC, r.id DESC
)
SELECT j.id, j.id AS job_id, v.payload, j.first_seen_on, j.last_seen_on,
       (p.active AND (v.payload->>'expiresAt' IS NULL OR
         (v.payload->>'expiresAt')::date >= (now() AT TIME ZONE 'Asia/Taipei')::date)) AS active
FROM jobs j JOIN presence p ON p.job_id = j.id
JOIN latest l ON l.job_id = j.id JOIN job_versions v ON v.id = l.version_id;
