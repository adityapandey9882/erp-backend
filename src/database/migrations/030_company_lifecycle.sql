ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

CREATE INDEX IF NOT EXISTS companies_archived_at_idx
  ON companies (archived_at);
