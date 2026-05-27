CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  permanent_address TEXT NULL,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  leave_updates BOOLEAN NOT NULL DEFAULT TRUE,
  announcement_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  payroll_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_settings_user_id_idx
  ON user_settings (user_id);
