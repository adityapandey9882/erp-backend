CREATE TABLE IF NOT EXISTS salary_structures (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  designation_id TEXT NOT NULL REFERENCES designations(id) ON DELETE CASCADE,
  base_amount NUMERIC(12, 2) NOT NULL CHECK (base_amount >= 0),
  currency_code TEXT NOT NULL CHECK (char_length(currency_code) = 3),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_structures_company_designation_unique UNIQUE (
    company_id,
    designation_id
  )
);

CREATE INDEX IF NOT EXISTS salary_structures_company_status_idx
  ON salary_structures (company_id, status);

CREATE INDEX IF NOT EXISTS salary_structures_company_designation_idx
  ON salary_structures (company_id, designation_id);
