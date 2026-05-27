CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_target TEXT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_status_check
    CHECK (status IN ('unread', 'read')),
  CONSTRAINT notifications_target_check
    CHECK (user_id IS NOT NULL OR role_target IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notifications_company_user_status_idx
  ON notifications (company_id, user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_company_role_status_idx
  ON notifications (company_id, role_target, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_company_created_idx
  ON notifications (company_id, created_at DESC);
