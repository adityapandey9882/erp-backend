CREATE TABLE IF NOT EXISTS company_policies (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_policies_type_check CHECK ("type" IN ('leave', 'attendance')),
  CONSTRAINT company_policies_unique_key UNIQUE (company_id, "type", key)
);

CREATE INDEX IF NOT EXISTS company_policies_company_type_idx
  ON company_policies (company_id, "type", key);
