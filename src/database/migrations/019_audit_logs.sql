CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_company_created_idx
  ON audit_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_company_user_created_idx
  ON audit_logs (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_company_action_created_idx
  ON audit_logs (company_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_company_entity_created_idx
  ON audit_logs (company_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_company_entity_type_idx
  ON audit_logs (company_id, entity_type);
