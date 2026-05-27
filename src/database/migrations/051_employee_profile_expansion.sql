ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
  ADD COLUMN IF NOT EXISTS gender TEXT NULL,
  ADD COLUMN IF NOT EXISTS marital_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS blood_group TEXT NULL,
  ADD COLUMN IF NOT EXISTS nationality TEXT NULL,
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employee_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS reporting_manager_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS work_location TEXT NULL,
  ADD COLUMN IF NOT EXISTS employment_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS github_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_reporting_manager_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_reporting_manager_id_fkey
      FOREIGN KEY (reporting_manager_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_gender_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_gender_check
      CHECK (
        gender IS NULL
        OR gender IN ('male', 'female', 'other', 'prefer-not-to-say')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_marital_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_marital_status_check
      CHECK (
        marital_status IS NULL
        OR marital_status IN (
          'single',
          'married',
          'divorced',
          'widowed',
          'separated',
          'prefer-not-to-say'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_employment_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_employment_type_check
      CHECK (
        employment_type IS NULL
        OR employment_type IN (
          'full-time',
          'part-time',
          'contract',
          'intern',
          'consultant'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_company_employee_id_idx
  ON users (company_id, employee_id);

CREATE INDEX IF NOT EXISTS users_company_reporting_manager_idx
  ON users (company_id, reporting_manager_id);

CREATE TABLE IF NOT EXISTS employee_bank_details (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NULL,
  account_holder_name TEXT NULL,
  account_number TEXT NULL,
  ifsc TEXT NULL,
  pan TEXT NULL,
  uan TEXT NULL,
  verified_at TIMESTAMPTZ NULL,
  verified_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_bank_details_company_user_idx
  ON employee_bank_details (company_id, user_id);

CREATE TABLE IF NOT EXISTS employee_education (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree TEXT NOT NULL,
  institution TEXT NOT NULL,
  field_of_study TEXT NULL,
  start_year INTEGER NULL,
  end_year INTEGER NULL,
  grade TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_education_company_user_idx
  ON employee_education (company_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS employee_skills (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NULL,
  proficiency INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_skills_proficiency_check
    CHECK (proficiency IS NULL OR (proficiency >= 0 AND proficiency <= 100))
);

CREATE INDEX IF NOT EXISTS employee_skills_company_user_idx
  ON employee_skills (company_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS employee_achievements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT NULL,
  achieved_at DATE NULL,
  credential_url TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_achievements_company_user_idx
  ON employee_achievements (company_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NULL,
  review_notes TEXT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_change_requests_type_check
    CHECK (request_type IN ('bank-details', 'job-information')),
  CONSTRAINT profile_change_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS profile_change_requests_company_user_idx
  ON profile_change_requests (company_id, user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS profile_change_requests_company_status_idx
  ON profile_change_requests (company_id, status, requested_at DESC);
