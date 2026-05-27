CREATE TABLE IF NOT EXISTS company_holidays (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('public', 'company', 'optional', 'restricted')
  ),
  description TEXT NULL,
  office_location_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, holiday_date, name)
);

CREATE INDEX IF NOT EXISTS company_holidays_company_date_idx
  ON company_holidays(company_id, holiday_date DESC);

CREATE INDEX IF NOT EXISTS company_holidays_company_type_idx
  ON company_holidays(company_id, type);

CREATE INDEX IF NOT EXISTS company_holidays_company_active_idx
  ON company_holidays(company_id, is_active, holiday_date DESC);
