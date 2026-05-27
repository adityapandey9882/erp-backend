CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_company_created_idx
  ON documents (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_company_user_created_idx
  ON documents (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_company_type_idx
  ON documents (company_id, type, created_at DESC);
