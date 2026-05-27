CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shifts_company_name_unique UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_shifts_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS shifts_company_created_idx
  ON shifts (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shifts_company_time_idx
  ON shifts (company_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS employee_shifts_shift_idx
  ON employee_shifts (shift_id);

CREATE INDEX IF NOT EXISTS employee_shifts_assigned_at_idx
  ON employee_shifts (assigned_at DESC);
