ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designation_id TEXT REFERENCES designations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_department_id_idx
  ON users (department_id);

CREATE INDEX IF NOT EXISTS users_designation_id_idx
  ON users (designation_id);
