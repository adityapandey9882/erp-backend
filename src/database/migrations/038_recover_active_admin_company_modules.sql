WITH module_keys(module_key) AS (
  VALUES
    ('admin'),
    ('hr'),
    ('accounts'),
    ('payroll'),
    ('projects'),
    ('team-lead'),
    ('employee-self')
)
INSERT INTO company_modules (
  company_id,
  module_key,
  is_enabled,
  created_at,
  updated_at
)
SELECT
  companies.id,
  module_keys.module_key,
  FALSE,
  NOW(),
  NOW()
FROM companies
CROSS JOIN module_keys
ON CONFLICT (company_id, module_key) DO NOTHING;

UPDATE company_modules AS modules
SET
  is_enabled = TRUE,
  updated_at = NOW()
FROM companies
INNER JOIN company_admins
  ON company_admins.company_id = companies.id
WHERE modules.company_id = companies.id
  AND modules.module_key = 'admin'
  AND companies.status = 'active'
  AND companies.onboarding_status = 'active'
  AND companies.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_modules AS enabled_modules
    WHERE enabled_modules.company_id = companies.id
      AND enabled_modules.is_enabled = TRUE
  );
