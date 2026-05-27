ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS manager_review_status TEXT,
  ADD COLUMN IF NOT EXISTS manager_reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_reviewed_at TIMESTAMPTZ NULL;

UPDATE leave_requests
SET manager_review_status = CASE
  WHEN status = 'pending' THEN 'pending'
  ELSE 'forwarded'
END
WHERE manager_review_status IS NULL;

ALTER TABLE leave_requests
  ALTER COLUMN manager_review_status SET DEFAULT 'pending',
  ALTER COLUMN manager_review_status SET NOT NULL;

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_manager_review_status_check;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_manager_review_status_check
  CHECK (manager_review_status IN ('pending', 'approved', 'forwarded', 'rejected'));

CREATE INDEX IF NOT EXISTS leave_requests_company_manager_review_status_idx
  ON leave_requests (company_id, manager_review_status, start_date DESC);

CREATE INDEX IF NOT EXISTS leave_requests_manager_reviewed_by_idx
  ON leave_requests (manager_reviewed_by_user_id);
