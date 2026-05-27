WITH role_modules(role_code, module_key) AS (
  VALUES
    ('admin', 'admin'),
    ('hr', 'hr'),
    ('accounts', 'accounts'),
    ('project-manager', 'projects'),
    ('team-lead', 'team-lead'),
    ('employee', 'employee-self')
),
required_modules AS (
  SELECT DISTINCT
    users.company_id,
    role_modules.module_key
  FROM users
  INNER JOIN role_modules
    ON role_modules.role_code = users.role
  INNER JOIN companies
    ON companies.id = users.company_id
  WHERE users.company_id IS NOT NULL
    AND users.is_active = TRUE
    AND companies.status = 'active'
    AND companies.archived_at IS NULL

  UNION

  SELECT DISTINCT
    company_admins.company_id,
    'admin' AS module_key
  FROM company_admins
  INNER JOIN companies
    ON companies.id = company_admins.company_id
  INNER JOIN users
    ON users.id = company_admins.admin_user_id
  WHERE users.is_active = TRUE
    AND companies.status = 'active'
    AND companies.archived_at IS NULL
)
INSERT INTO company_modules (
  company_id,
  module_key,
  is_enabled,
  created_at,
  updated_at
)
SELECT
  required_modules.company_id,
  required_modules.module_key,
  TRUE,
  NOW(),
  NOW()
FROM required_modules
ON CONFLICT (company_id, module_key) DO UPDATE
SET
  is_enabled = TRUE,
  updated_at = NOW();
