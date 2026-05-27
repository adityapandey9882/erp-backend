CREATE TABLE IF NOT EXISTS office_locations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  country TEXT NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 100,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS office_locations_company_active_idx
  ON office_locations (company_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS office_locations_company_primary_idx
  ON office_locations (company_id, is_primary DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS office_locations_company_primary_unique
  ON office_locations (company_id)
  WHERE is_primary = TRUE AND is_active = TRUE;
