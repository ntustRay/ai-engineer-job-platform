// Resolve retries within a scope and day before counting observations. An
// unsuccessful retry must not erase an earlier complete capture of that day.
// $1 role, $2 skill, $3 requirement kind, $4 location, $5 evidence month.
export const marketHistorySql = `
WITH daily AS (
  SELECT DISTINCT ON (scope_key, observed_on)
         id, scope_key, observed_on, observed_at, status,
         date_trunc('month', observed_on)::date AS month
  FROM collector_runs
  WHERE observed_on >= date_trunc('month', now() AT TIME ZONE 'Asia/Taipei') - interval '11 months'
    AND observed_on <= (now() AT TIME ZONE 'Asia/Taipei')::date
  ORDER BY scope_key, observed_on,
           CASE status WHEN 'complete' THEN 0 WHEN 'capped' THEN 1
                       WHEN 'partial' THEN 2 ELSE 3 END, observed_at DESC, id DESC
), coverage AS (
  SELECT month, array_agg(DISTINCT scope_key ORDER BY scope_key) AS scopes,
         count(DISTINCT observed_on) FILTER (WHERE status <> 'failed')::int AS observed_days,
         bool_and(status = 'complete') AND count(*) =
           extract(day FROM (month + interval '1 month - 1 day')) * count(DISTINCT scope_key)
           AS complete
  FROM daily
  GROUP BY month
), last_version AS (
  SELECT DISTINCT ON (d.month, o.job_id) d.month, o.job_id, o.version_id
  FROM daily d JOIN job_observations o ON o.run_id = d.id
  WHERE d.status <> 'failed'
  ORDER BY d.month, o.job_id, d.observed_at DESC, d.id DESC
), filtered AS (
  SELECT l.month, l.job_id, v.rules_version, v.payload,
         ($2::text IS NULL AND $3::text IS NULL OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(v.payload->'requirements') AS req
           WHERE ($2::text IS NULL OR req->'skillIds' ? $2)
             AND ($3::text IS NULL OR req->>'kind' = $3)
         )) AS matches
  FROM last_version l JOIN job_versions v ON v.id = l.version_id
  WHERE ($1::text IS NULL OR v.payload->>'role' = $1)
    AND ($4::text IS NULL OR position(lower(replace($4, '臺', '台')) IN
               lower(replace(v.payload->>'location', '臺', '台'))) > 0)
), counts AS (
  SELECT month, count(*)::int AS total,
         count(*) FILTER (WHERE matches)::int AS matching,
         array_agg(DISTINCT rules_version ORDER BY rules_version) AS rule_versions
  FROM filtered GROUP BY month
)
SELECT to_char(c.month, 'YYYY-MM') AS period, c.scopes,
       c.observed_days AS "observedDays", c.complete,
       coalesce(n.total, 0) AS total, coalesce(n.matching, 0) AS matching,
       coalesce(n.rule_versions, '{}') AS "ruleVersions",
       CASE WHEN to_char(c.month, 'YYYY-MM') = $5::text THEN (
         SELECT coalesce(jsonb_agg(e.payload ORDER BY e.job_id), '[]'::jsonb)
         FROM (SELECT f.job_id, f.payload FROM filtered f
               WHERE f.month = c.month AND f.matches ORDER BY f.job_id LIMIT 12) e
       ) ELSE '[]'::jsonb END AS evidence
FROM coverage c LEFT JOIN counts n ON n.month = c.month
ORDER BY c.month
`;
