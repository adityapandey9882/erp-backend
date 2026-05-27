CREATE TABLE IF NOT EXISTS site_locations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NULL REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  client_name TEXT NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_locations_geofence_radius_check
    CHECK (geofence_radius_meters >= 20),
  CONSTRAINT site_locations_latitude_check
    CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT site_locations_longitude_check
    CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT site_locations_non_zero_coordinate_check
    CHECK (NOT (ABS(latitude) < 0.05 AND ABS(longitude) < 0.05))
);

CREATE INDEX IF NOT EXISTS site_locations_company_active_idx
  ON site_locations (company_id, is_active, name);

CREATE INDEX IF NOT EXISTS site_locations_company_project_idx
  ON site_locations (company_id, project_id, is_active, name);

CREATE TABLE IF NOT EXISTS employee_site_assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_location_id TEXT NOT NULL REFERENCES site_locations(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_site_assignments_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (company_id, site_location_id, employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS employee_site_assignments_company_employee_idx
  ON employee_site_assignments (company_id, employee_id, is_active, effective_from DESC);

CREATE INDEX IF NOT EXISTS employee_site_assignments_company_site_idx
  ON employee_site_assignments (company_id, site_location_id, is_active, effective_from DESC);

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS site_location_id TEXT NULL REFERENCES site_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id TEXT NULL REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS attendance_records_company_site_location_idx
  ON attendance_records (company_id, site_location_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS attendance_records_company_project_idx
  ON attendance_records (company_id, project_id, attendance_date DESC);

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_in_verification_source_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_check_in_verification_source_check
    CHECK (
      check_in_verification_source IS NULL
      OR check_in_verification_source IN ('gps_verified', 'qr_mobile_gps', 'field_site_gps')
    );

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_out_verification_source_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_check_out_verification_source_check
    CHECK (
      check_out_verification_source IS NULL
      OR check_out_verification_source IN ('gps_verified', 'qr_mobile_gps', 'field_site_gps')
    );
