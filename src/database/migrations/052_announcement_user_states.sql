CREATE TABLE IF NOT EXISTS announcement_user_states (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_user_states_user_idx
  ON announcement_user_states(company_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS announcement_user_states_announcement_idx
  ON announcement_user_states(announcement_id);
