ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_in_latitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_in_longitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_in_accuracy_meters DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_in_distance_meters DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_in_verification_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_out_accuracy_meters DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_out_distance_meters DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS check_out_verification_source TEXT NULL;

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_in_verification_source_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_check_in_verification_source_check
    CHECK (
      check_in_verification_source IS NULL
      OR check_in_verification_source IN ('gps_verified', 'qr_mobile_gps')
    );

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_out_verification_source_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_check_out_verification_source_check
    CHECK (
      check_out_verification_source IS NULL
      OR check_out_verification_source IN ('gps_verified', 'qr_mobile_gps')
    );

CREATE TABLE IF NOT EXISTS attendance_qr_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_location_id TEXT NOT NULL REFERENCES office_locations(id) ON DELETE CASCADE,
  attendance_record_id TEXT NULL REFERENCES attendance_records(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ NULL,
  verified_latitude DOUBLE PRECISION NULL,
  verified_longitude DOUBLE PRECISION NULL,
  verified_accuracy_meters DOUBLE PRECISION NULL,
  verified_distance_meters DOUBLE PRECISION NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_qr_sessions_action_check
    CHECK (action IN ('check_in', 'check_out')),
  CONSTRAINT attendance_qr_sessions_status_check
    CHECK (status IN ('pending', 'verified', 'expired', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_company_idx
  ON attendance_qr_sessions (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_employee_idx
  ON attendance_qr_sessions (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_status_idx
  ON attendance_qr_sessions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_expires_at_idx
  ON attendance_qr_sessions (expires_at);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_token_hash_idx
  ON attendance_qr_sessions (token_hash);
