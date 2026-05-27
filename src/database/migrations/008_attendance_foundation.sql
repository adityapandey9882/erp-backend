CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_records_company_user_date_unique
    UNIQUE (company_id, user_id, attendance_date),
  CONSTRAINT attendance_records_checkout_after_checkin
    CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

CREATE INDEX IF NOT EXISTS attendance_records_company_date_idx
  ON attendance_records (company_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS attendance_records_user_date_idx
  ON attendance_records (user_id, attendance_date DESC);
