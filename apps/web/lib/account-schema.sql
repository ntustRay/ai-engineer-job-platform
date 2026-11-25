CREATE TABLE IF NOT EXISTS job_profile_entries (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('skills','favorites','applied','selectedRepos')),
  value text NOT NULL CHECK (length(value) BETWEEN 1 AND 256),
  PRIMARY KEY (user_id, bucket, value)
)
