CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS designations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_company_name_lower_unique_idx
  ON departments (company_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS departments_company_code_lower_unique_idx
  ON departments (company_id, LOWER(code));

CREATE INDEX IF NOT EXISTS departments_company_created_at_idx
  ON departments (company_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS designations_company_title_lower_unique_idx
  ON designations (company_id, LOWER(title));

CREATE UNIQUE INDEX IF NOT EXISTS designations_company_code_lower_unique_idx
  ON designations (company_id, LOWER(code));

CREATE INDEX IF NOT EXISTS designations_company_department_idx
  ON designations (company_id, department_id);

CREATE INDEX IF NOT EXISTS designations_company_created_at_idx
  ON designations (company_id, created_at DESC);
