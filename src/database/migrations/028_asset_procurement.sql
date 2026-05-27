CREATE TABLE IF NOT EXISTS asset_procurements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  purchase_date DATE NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_procurements_company_purchase_idx
  ON asset_procurements (company_id, purchase_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS asset_procurement_items (
  id TEXT PRIMARY KEY,
  procurement_id TEXT NOT NULL REFERENCES asset_procurements(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_procurement_items_procurement_idx
  ON asset_procurement_items (procurement_id, created_at ASC);

ALTER TABLE company_assets
  ADD COLUMN IF NOT EXISTS procurement_item_id TEXT
    REFERENCES asset_procurement_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS company_assets_company_procurement_item_idx
  ON company_assets (company_id, procurement_item_id);
