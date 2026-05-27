ALTER TABLE attendance_records
  ALTER COLUMN check_in_at DROP NOT NULL;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS office_location_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS biometric_device_id TEXT NULL REFERENCES biometric_devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL;

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_checkout_after_checkin;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_checkout_after_checkin
    CHECK (
      check_in_at IS NULL
      OR check_out_at IS NULL
      OR check_out_at >= check_in_at
    );

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_source_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_source_check
    CHECK (source IN ('biometric', 'gps', 'manual', 'remote', 'field'));

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_status_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_status_check
    CHECK (status IN ('checked-in', 'present', 'late', 'half-day', 'missing', 'pending', 'absent'));

UPDATE attendance_records
SET
  source = 'manual',
  status = CASE
    WHEN check_in_at IS NULL THEN 'missing'
    WHEN check_out_at IS NULL THEN 'checked-in'
    ELSE 'present'
  END
WHERE source = 'manual'
   OR status = 'pending';

CREATE INDEX IF NOT EXISTS attendance_records_company_status_idx
  ON attendance_records (company_id, status, attendance_date DESC);

CREATE INDEX IF NOT EXISTS attendance_records_company_location_idx
  ON attendance_records (company_id, office_location_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS attendance_records_company_device_idx
  ON attendance_records (company_id, biometric_device_id, attendance_date DESC);

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS grace_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_grace_minutes_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_grace_minutes_check
    CHECK (grace_minutes BETWEEN 0 AND 240);

ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_break_minutes_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_break_minutes_check
    CHECK (break_minutes BETWEEN 0 AND 480);

ALTER TABLE employee_shifts
  ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE NULL;

UPDATE employee_shifts
SET effective_from = assigned_at::date
WHERE effective_from = CURRENT_DATE;

ALTER TABLE employee_shifts
  DROP CONSTRAINT IF EXISTS employee_shifts_user_unique;

ALTER TABLE employee_shifts
  DROP CONSTRAINT IF EXISTS employee_shifts_effective_window_check;

ALTER TABLE employee_shifts
  ADD CONSTRAINT employee_shifts_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from);

CREATE UNIQUE INDEX IF NOT EXISTS employee_shifts_current_assignment_unique_idx
  ON employee_shifts (user_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS employee_shifts_user_effective_idx
  ON employee_shifts (user_id, effective_from DESC);

ALTER TABLE biometric_devices
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline';

ALTER TABLE biometric_devices
  DROP CONSTRAINT IF EXISTS biometric_devices_status_check;

ALTER TABLE biometric_devices
  ADD CONSTRAINT biometric_devices_status_check
    CHECK (status IN ('online', 'offline', 'inactive'));

UPDATE biometric_devices
SET status = CASE
  WHEN is_active = FALSE THEN 'inactive'
  WHEN last_sync_at IS NOT NULL THEN 'online'
  ELSE 'offline'
END;

ALTER TABLE biometric_punch_logs
  ADD COLUMN IF NOT EXISTS biometric_identifier TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL;

ALTER TABLE biometric_punch_logs
  DROP CONSTRAINT IF EXISTS biometric_punch_logs_punch_type_check;

ALTER TABLE biometric_punch_logs
  ADD CONSTRAINT biometric_punch_logs_punch_type_check
    CHECK (
      punch_type IN (
        'check-in',
        'check-out',
        'break-start',
        'break-end',
        'in',
        'out',
        'unknown'
      )
    );

CREATE INDEX IF NOT EXISTS biometric_punch_logs_device_status_idx
  ON biometric_punch_logs (company_id, biometric_device_id, sync_status, punch_time DESC);

ALTER TABLE attendance_corrections
  ADD COLUMN IF NOT EXISTS attendance_date DATE NULL,
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'correction',
  ADD COLUMN IF NOT EXISTS approver_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

ALTER TABLE attendance_corrections
  DROP CONSTRAINT IF EXISTS attendance_corrections_request_type_check;

ALTER TABLE attendance_corrections
  ADD CONSTRAINT attendance_corrections_request_type_check
    CHECK (
      request_type IN (
        'missed_check_in',
        'missed_check_out',
        'full_day_missing',
        'correction'
      )
    );

UPDATE attendance_corrections
SET
  attendance_date = attendance_records.attendance_date,
  request_type = CASE
    WHEN requested_check_in IS NOT NULL AND requested_check_out IS NOT NULL THEN 'correction'
    WHEN requested_check_in IS NOT NULL THEN 'missed_check_in'
    WHEN requested_check_out IS NOT NULL THEN 'missed_check_out'
    ELSE 'correction'
  END
FROM attendance_records
WHERE attendance_records.id = attendance_corrections.attendance_id
  AND attendance_corrections.attendance_date IS NULL;

ALTER TABLE attendance_corrections
  ALTER COLUMN attendance_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_corrections_company_date_idx
  ON attendance_corrections (company_id, attendance_date DESC, created_at DESC);
