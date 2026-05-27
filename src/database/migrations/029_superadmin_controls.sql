DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE audit_logs
      RENAME COLUMN user_id TO actor_user_id;
  END IF;
END $$;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_user_id TEXT NULL;

ALTER TABLE audit_logs
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_company_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
  ON audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS superadmin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO superadmin_settings (key, value, updated_at)
VALUES
  (
    'general',
    '{"timezone":"Asia/Calcutta","dateFormat":"dd MMM yyyy"}'::jsonb,
    NOW()
  ),
  (
    'security',
    '{"minimumPasswordLength":8,"requireUppercase":false,"requireNumber":false,"sessionTimeoutMinutes":480}'::jsonb,
    NOW()
  ),
  (
    'notifications',
    '{"companyUserCreated":true,"assetAssigned":true,"leaveStatusChanged":true,"procurementCreated":true}'::jsonb,
    NOW()
  ),
  (
    'modules',
    '{"defaultEnabledModules":["admin","employee-self"]}'::jsonb,
    NOW()
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT;

UPDATE companies
SET onboarding_status = CASE
  WHEN status = 'active' THEN 'active'
  ELSE 'suspended'
END
WHERE onboarding_status IS NULL;

ALTER TABLE companies
  ALTER COLUMN onboarding_status SET DEFAULT 'pending';

UPDATE companies
SET onboarding_status = 'pending'
WHERE onboarding_status IS NULL;

ALTER TABLE companies
  ALTER COLUMN onboarding_status SET NOT NULL;

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_onboarding_status_check;

ALTER TABLE companies
  ADD CONSTRAINT companies_onboarding_status_check
    CHECK (onboarding_status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS companies_onboarding_status_idx
  ON companies (onboarding_status);
