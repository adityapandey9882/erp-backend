CREATE INDEX IF NOT EXISTS companies_status_idx
  ON companies (status);

CREATE INDEX IF NOT EXISTS companies_created_at_idx
  ON companies (created_at DESC);

CREATE INDEX IF NOT EXISTS company_admins_admin_user_id_idx
  ON company_admins (admin_user_id);

CREATE INDEX IF NOT EXISTS company_modules_module_key_enabled_idx
  ON company_modules (module_key, is_enabled);
