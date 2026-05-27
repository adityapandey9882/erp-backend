ALTER TABLE company_assets
  DROP CONSTRAINT IF EXISTS company_assets_status_check;

ALTER TABLE company_assets
  ADD CONSTRAINT company_assets_status_check
  CHECK (
    status IN (
      'available',
      'assigned',
      'returned',
      'damaged',
      'under-maintenance'
    )
  );

CREATE TABLE IF NOT EXISTS asset_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES company_assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'created',
      'assigned',
      'returned',
      'maintenance',
      'status-updated',
      'note-added'
    )
  ),
  notes TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_events_company_asset_idx
  ON asset_events (company_id, asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS asset_events_company_type_idx
  ON asset_events (company_id, type, created_at DESC);

INSERT INTO asset_events (
  id,
  company_id,
  asset_id,
  type,
  notes,
  actor_user_id,
  created_at
)
SELECT
  company_assets.id || '-created',
  company_assets.company_id,
  company_assets.id,
  'created',
  NULL,
  NULL,
  company_assets.created_at
FROM company_assets
WHERE NOT EXISTS (
  SELECT 1
  FROM asset_events
  WHERE asset_events.company_id = company_assets.company_id
    AND asset_events.asset_id = company_assets.id
    AND asset_events.type = 'created'
);
