ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_company_id_idx
  ON users (company_id);

UPDATE users
SET company_id = admin_company_assignments.company_id
FROM (
  SELECT
    admin_user_id,
    MIN(company_id) AS company_id
  FROM company_admins
  GROUP BY admin_user_id
) AS admin_company_assignments
WHERE users.id = admin_company_assignments.admin_user_id
  AND users.role = 'admin'
  AND users.company_id IS NULL;
