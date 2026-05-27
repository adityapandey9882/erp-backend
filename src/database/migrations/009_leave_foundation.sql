CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS leave_requests_company_status_start_date_idx
  ON leave_requests (company_id, status, start_date DESC);

CREATE INDEX IF NOT EXISTS leave_requests_company_created_at_idx
  ON leave_requests (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS leave_requests_user_start_date_idx
  ON leave_requests (user_id, start_date DESC);
