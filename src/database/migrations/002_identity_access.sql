CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS users_role_active_idx
  ON users (role, is_active);
