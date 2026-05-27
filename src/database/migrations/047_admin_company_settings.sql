ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS legal_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS cin TEXT NULL,
  ADD COLUMN IF NOT EXISTS gstin TEXT NULL,
  ADD COLUMN IF NOT EXISTS pan TEXT NULL,
  ADD COLUMN IF NOT EXISTS company_size TEXT NULL,
  ADD COLUMN IF NOT EXISTS website TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT NULL,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT NULL,
  ADD COLUMN IF NOT EXISTS city TEXT NULL,
  ADD COLUMN IF NOT EXISTS state TEXT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT NULL,
  ADD COLUMN IF NOT EXISTS postal_code TEXT NULL;

CREATE TABLE IF NOT EXISTS company_attendance_settings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  default_shift_start TIME NOT NULL DEFAULT '09:30',
  default_shift_end TIME NOT NULL DEFAULT '18:30',
  grace_time_minutes INTEGER NOT NULL DEFAULT 15,
  half_day_threshold_minutes INTEGER NOT NULL DEFAULT 240,
  full_day_threshold_minutes INTEGER NOT NULL DEFAULT 480,
  overtime_threshold_minutes INTEGER NOT NULL DEFAULT 540,
  weekly_off_days TEXT[] NOT NULL DEFAULT ARRAY['saturday', 'sunday']::text[],
  geofence_required BOOLEAN NOT NULL DEFAULT TRUE,
  remote_attendance_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  field_visit_attendance_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  break_tracking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_attendance_settings_grace_check
    CHECK (grace_time_minutes BETWEEN 0 AND 240),
  CONSTRAINT company_attendance_settings_half_day_check
    CHECK (half_day_threshold_minutes BETWEEN 0 AND 1440),
  CONSTRAINT company_attendance_settings_full_day_check
    CHECK (full_day_threshold_minutes BETWEEN 0 AND 1440),
  CONSTRAINT company_attendance_settings_overtime_check
    CHECK (overtime_threshold_minutes BETWEEN 0 AND 1440)
);

CREATE TABLE IF NOT EXISTS biometric_devices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  office_location_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  ip_address TEXT NULL,
  port INTEGER NULL,
  serial_number TEXT NULL,
  connection_type TEXT NOT NULL DEFAULT 'lan',
  sync_interval_minutes INTEGER NOT NULL DEFAULT 30,
  last_sync_at TIMESTAMPTZ NULL,
  last_sync_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biometric_devices_type_check
    CHECK (device_type IN ('fingerprint', 'face', 'rfid')),
  CONSTRAINT biometric_devices_connection_type_check
    CHECK (connection_type IN ('lan', 'wan', 'cloud', 'usb')),
  CONSTRAINT biometric_devices_port_check
    CHECK (port IS NULL OR port BETWEEN 1 AND 65535),
  CONSTRAINT biometric_devices_sync_interval_check
    CHECK (sync_interval_minutes BETWEEN 1 AND 1440),
  CONSTRAINT biometric_devices_last_sync_status_check
    CHECK (last_sync_status IN ('pending', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS biometric_devices_company_active_idx
  ON biometric_devices (company_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_biometric_mappings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biometric_device_id TEXT NULL REFERENCES biometric_devices(id) ON DELETE SET NULL,
  employee_code TEXT NULL,
  biometric_identifier TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_biometric_mappings_company_user_idx
  ON employee_biometric_mappings (company_id, user_id, is_active);

CREATE TABLE IF NOT EXISTS biometric_punch_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  biometric_device_id TEXT NULL REFERENCES biometric_devices(id) ON DELETE SET NULL,
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  punch_time TIMESTAMPTZ NOT NULL,
  punch_type TEXT NOT NULL DEFAULT 'check-in',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biometric_punch_logs_punch_type_check
    CHECK (punch_type IN ('check-in', 'check-out', 'break-start', 'break-end')),
  CONSTRAINT biometric_punch_logs_sync_status_check
    CHECK (sync_status IN ('pending', 'processed', 'failed'))
);

CREATE INDEX IF NOT EXISTS biometric_punch_logs_company_time_idx
  ON biometric_punch_logs (company_id, punch_time DESC);

CREATE TABLE IF NOT EXISTS company_payroll_settings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  salary_components TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  earnings_components TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  deduction_components TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  pf_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  esi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  salary_cycle TEXT NOT NULL DEFAULT 'monthly',
  payroll_lock_day INTEGER NOT NULL DEFAULT 25,
  payslip_publish_day INTEGER NOT NULL DEFAULT 1,
  overtime_rate_rule TEXT NOT NULL DEFAULT '1x regular rate after threshold',
  unpaid_leave_deduction_rule TEXT NOT NULL DEFAULT 'Per-day deduction on gross salary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_payroll_settings_cycle_check
    CHECK (salary_cycle IN ('monthly', 'semi-monthly', 'weekly')),
  CONSTRAINT company_payroll_settings_lock_day_check
    CHECK (payroll_lock_day BETWEEN 1 AND 31),
  CONSTRAINT company_payroll_settings_publish_day_check
    CHECK (payslip_publish_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS company_notification_settings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  leave_approval_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  payroll_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  announcement_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
