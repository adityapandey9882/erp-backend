ALTER TABLE offboarding_requests
  ADD COLUMN IF NOT EXISTS initiated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS completed_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

UPDATE offboarding_requests
SET initiated_by = user_id
WHERE initiated_by IS NULL;

UPDATE offboarding_requests
SET
  completed_by = COALESCE(completed_by, initiated_by),
  completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'completed';

ALTER TABLE offboarding_requests
  ALTER COLUMN initiated_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS offboarding_requests_company_initiated_by_idx
  ON offboarding_requests (company_id, initiated_by, created_at DESC);

CREATE INDEX IF NOT EXISTS offboarding_requests_company_completed_by_idx
  ON offboarding_requests (company_id, completed_by, completed_at DESC)
  WHERE completed_by IS NOT NULL;
