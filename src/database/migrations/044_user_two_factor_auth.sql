CREATE TABLE IF NOT EXISTS user_two_factor_auth (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'authenticator-app',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secret_encrypted TEXT NULL,
  pending_secret_encrypted TEXT NULL,
  recovery_codes_hash TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled_at TIMESTAMPTZ NULL,
  disabled_at TIMESTAMPTZ NULL,
  last_verified_at TIMESTAMPTZ NULL,
  setup_expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_two_factor_auth_provider_check
    CHECK (provider IN ('authenticator-app'))
);

CREATE INDEX IF NOT EXISTS user_two_factor_auth_user_id_idx
  ON user_two_factor_auth (user_id);
