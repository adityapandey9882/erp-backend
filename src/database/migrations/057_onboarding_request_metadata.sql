ALTER TABLE onboarding_requests
  ADD COLUMN IF NOT EXISTS joining_date DATE NULL,
  ADD COLUMN IF NOT EXISTS assigned_hr_user_id TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'onboarding_requests'
      AND constraint_name = 'onboarding_requests_assigned_hr_user_id_fkey'
  ) THEN
    ALTER TABLE onboarding_requests
      ADD CONSTRAINT onboarding_requests_assigned_hr_user_id_fkey
      FOREIGN KEY (assigned_hr_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS onboarding_requests_company_joining_date_idx
  ON onboarding_requests (company_id, joining_date DESC);

CREATE INDEX IF NOT EXISTS onboarding_requests_company_assigned_hr_idx
  ON onboarding_requests (company_id, assigned_hr_user_id);
