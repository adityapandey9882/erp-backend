ALTER TABLE company_attendance_settings
  ADD COLUMN IF NOT EXISTS allow_browser_gps_fallback BOOLEAN NOT NULL DEFAULT FALSE;
