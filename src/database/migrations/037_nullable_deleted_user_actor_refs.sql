DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE documents
      ALTER COLUMN uploaded_by DROP NOT NULL;

    ALTER TABLE documents
      DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;

    ALTER TABLE documents
      ADD CONSTRAINT documents_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offboarding_requests'
      AND column_name = 'initiated_by'
  ) THEN
    ALTER TABLE offboarding_requests
      ALTER COLUMN initiated_by DROP NOT NULL;

    ALTER TABLE offboarding_requests
      DROP CONSTRAINT IF EXISTS offboarding_requests_initiated_by_fkey;

    ALTER TABLE offboarding_requests
      ADD CONSTRAINT offboarding_requests_initiated_by_fkey
      FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
