CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NULL,
  browser TEXT NULL,
  operating_system TEXT NULL,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  ip_address TEXT NULL,
  approx_location TEXT NULL,
  user_agent TEXT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_sessions_device_type_check
    CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown'))
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
  ON user_sessions (user_id);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_active_idx
  ON user_sessions (user_id, is_revoked, expires_at DESC);
