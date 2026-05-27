ALTER TABLE offboarding_requests
  ADD COLUMN IF NOT EXISTS assigned_hr_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id TEXT NULL REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designation_id TEXT NULL REFERENCES designations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporting_manager_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exit_type TEXT NULL CHECK (
    exit_type IN (
      'resignation',
      'termination',
      'retirement',
      'contract-end',
      'mutual-separation'
    )
  ),
  ADD COLUMN IF NOT EXISTS resignation_date DATE NULL,
  ADD COLUMN IF NOT EXISTS last_working_date DATE NULL,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER NULL CHECK (notice_period_days >= 0),
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS expected_asset_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS requested_document_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS exit_interview_scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS final_settlement_amount NUMERIC(12, 2) NULL;

UPDATE offboarding_requests
SET
  assigned_hr_user_id = COALESCE(offboarding_requests.assigned_hr_user_id, offboarding_requests.initiated_by),
  department_id = COALESCE(offboarding_requests.department_id, users.department_id),
  designation_id = COALESCE(offboarding_requests.designation_id, users.designation_id),
  reporting_manager_user_id = COALESCE(
    offboarding_requests.reporting_manager_user_id,
    users.reporting_manager_id
  ),
  exit_type = COALESCE(offboarding_requests.exit_type, 'resignation'),
  resignation_date = COALESCE(
    offboarding_requests.resignation_date,
    DATE(offboarding_requests.created_at)
  ),
  last_working_date = COALESCE(
    offboarding_requests.last_working_date,
    DATE(offboarding_requests.created_at + INTERVAL '30 days')
  ),
  notice_period_days = COALESCE(
    offboarding_requests.notice_period_days,
    GREATEST(
      (
        COALESCE(
          offboarding_requests.last_working_date,
          DATE(offboarding_requests.created_at + INTERVAL '30 days')
        ) - COALESCE(offboarding_requests.resignation_date, DATE(offboarding_requests.created_at))
      ),
      0
    )
  ),
  expected_asset_count = COALESCE(
    offboarding_requests.expected_asset_count,
    (
      SELECT COUNT(*)::int
      FROM company_assets
      WHERE company_assets.company_id = offboarding_requests.company_id
        AND company_assets.assigned_to_user_id = offboarding_requests.user_id
        AND company_assets.status = 'assigned'
    )
  ),
  requested_document_count = COALESCE(offboarding_requests.requested_document_count, 3),
  exit_interview_scheduled_at = COALESCE(
    offboarding_requests.exit_interview_scheduled_at,
    DATE(offboarding_requests.last_working_date)::timestamptz
  )
FROM users
WHERE users.id = offboarding_requests.user_id;

UPDATE offboarding_requests
SET exit_interview_scheduled_at = DATE(last_working_date)::timestamptz
WHERE exit_interview_scheduled_at IS NULL
  AND last_working_date IS NOT NULL;

ALTER TABLE offboarding_requests
  ALTER COLUMN assigned_hr_user_id SET NOT NULL,
  ALTER COLUMN exit_type SET NOT NULL,
  ALTER COLUMN resignation_date SET NOT NULL,
  ALTER COLUMN last_working_date SET NOT NULL,
  ALTER COLUMN notice_period_days SET NOT NULL,
  ALTER COLUMN expected_asset_count SET NOT NULL,
  ALTER COLUMN requested_document_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS offboarding_requests_company_assigned_hr_idx
  ON offboarding_requests (company_id, assigned_hr_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS offboarding_requests_company_last_working_idx
  ON offboarding_requests (company_id, last_working_date DESC, created_at DESC);
