CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN (
      'superadmin',
      'admin',
      'hr',
      'accounts',
      'project-manager',
      'team-lead',
      'employee'
    )
  ),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
