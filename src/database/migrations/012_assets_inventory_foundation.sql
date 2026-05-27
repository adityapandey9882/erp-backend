CREATE TABLE IF NOT EXISTS company_assets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serial_number TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('available', 'assigned', 'returned', 'damaged')
  ),
  assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_assets_company_asset_code_unique UNIQUE (company_id, asset_code),
  CONSTRAINT company_assets_company_serial_unique UNIQUE (company_id, serial_number)
);

CREATE INDEX IF NOT EXISTS company_assets_company_status_idx
  ON company_assets (company_id, status);

CREATE INDEX IF NOT EXISTS company_assets_company_category_idx
  ON company_assets (company_id, category);

CREATE INDEX IF NOT EXISTS company_assets_company_assigned_to_idx
  ON company_assets (company_id, assigned_to_user_id);
