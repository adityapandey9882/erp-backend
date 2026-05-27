DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE audit_logs
      ALTER COLUMN actor_user_id DROP NOT NULL;
  END IF;
END $$;
