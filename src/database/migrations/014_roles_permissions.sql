CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS permissions_key_unique_idx
  ON permissions (LOWER(key));

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (is_system = FALSE OR company_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_global_code_unique_idx
  ON roles (LOWER(code))
  WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_company_code_unique_idx
  ON roles (company_id, LOWER(code))
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS roles_company_id_idx
  ON roles (company_id);

CREATE INDEX IF NOT EXISTS roles_is_system_idx
  ON roles (is_system);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx
  ON role_permissions (role_id);

CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
  ON role_permissions (permission_id);
