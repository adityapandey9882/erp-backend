ALTER TABLE approval_flows
  DROP CONSTRAINT IF EXISTS approval_flows_entity_type_check;

ALTER TABLE approval_flows
  ADD CONSTRAINT approval_flows_entity_type_check
    CHECK (entity_type IN ('leave', 'onboarding', 'offboarding', 'attendance-correction'));

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_id TEXT NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  requested_check_in TIMESTAMPTZ NULL,
  requested_check_out TIMESTAMPTZ NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attendance_corrections_company_created_idx
  ON attendance_corrections (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_corrections_company_status_idx
  ON attendance_corrections (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_corrections_company_user_idx
  ON attendance_corrections (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_corrections_company_attendance_idx
  ON attendance_corrections (company_id, attendance_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_corrections_pending_unique_idx
  ON attendance_corrections (company_id, user_id, attendance_id)
  WHERE status = 'pending';
