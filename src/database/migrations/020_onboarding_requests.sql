CREATE TABLE IF NOT EXISTS onboarding_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_requests_company_created_idx
  ON onboarding_requests (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_requests_company_status_idx
  ON onboarding_requests (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_requests_company_user_idx
  ON onboarding_requests (company_id, user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_requests_company_user_active_unique
  ON onboarding_requests (company_id, user_id)
  WHERE status IN ('pending', 'approved');
