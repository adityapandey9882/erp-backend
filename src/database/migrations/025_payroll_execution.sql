CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  status TEXT NOT NULL CHECK (status IN ('draft', 'processed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_runs_company_period_unique UNIQUE (company_id, month, year)
);

CREATE INDEX IF NOT EXISTS payroll_runs_company_period_idx
  ON payroll_runs (company_id, year DESC, month DESC);

CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_salary NUMERIC(12, 2) NOT NULL CHECK (base_salary >= 0),
  final_salary NUMERIC(12, 2) NOT NULL CHECK (final_salary >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_records_run_user_unique UNIQUE (run_id, user_id)
);

CREATE INDEX IF NOT EXISTS payroll_records_run_idx
  ON payroll_records (run_id);

CREATE INDEX IF NOT EXISTS payroll_records_user_idx
  ON payroll_records (user_id);
