ALTER TABLE company_assets
  ADD COLUMN IF NOT EXISTS brand_model TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_expiry DATE,
  ADD COLUMN IF NOT EXISTS condition_label TEXT NOT NULL DEFAULT 'Good',
  ADD COLUMN IF NOT EXISTS expected_return_date DATE,
  ADD COLUMN IF NOT EXISTS assignment_condition TEXT,
  ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

UPDATE company_assets
SET purchase_date = asset_procurements.purchase_date
FROM asset_procurement_items
INNER JOIN asset_procurements
  ON asset_procurements.id = asset_procurement_items.procurement_id
WHERE company_assets.procurement_item_id = asset_procurement_items.id
  AND company_assets.purchase_date IS NULL;

CREATE INDEX IF NOT EXISTS company_assets_company_warranty_idx
  ON company_assets (company_id, warranty_expiry);
