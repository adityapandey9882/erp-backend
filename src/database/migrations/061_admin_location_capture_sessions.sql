CREATE TABLE IF NOT EXISTS admin_location_capture_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ NULL,
  captured_latitude DOUBLE PRECISION NULL,
  captured_longitude DOUBLE PRECISION NULL,
  captured_accuracy_meters DOUBLE PRECISION NULL,
  captured_address TEXT NULL,
  captured_city TEXT NULL,
  captured_state TEXT NULL,
  captured_country TEXT NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_location_capture_sessions_status_check
    CHECK (status IN ('pending', 'captured', 'expired', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS admin_location_capture_sessions_company_idx
  ON admin_location_capture_sessions (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_location_capture_sessions_admin_user_idx
  ON admin_location_capture_sessions (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_location_capture_sessions_status_idx
  ON admin_location_capture_sessions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_location_capture_sessions_expires_at_idx
  ON admin_location_capture_sessions (expires_at);

CREATE INDEX IF NOT EXISTS admin_location_capture_sessions_token_hash_idx
  ON admin_location_capture_sessions (token_hash);
