ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS users_role_suspended_at_idx
  ON users (role, suspended_at);
