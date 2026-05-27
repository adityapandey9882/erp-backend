ALTER TABLE document_folders
  ADD COLUMN IF NOT EXISTS folder_scope TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

UPDATE document_folders
SET folder_scope = CASE
  WHEN user_id IS NULL THEN 'company'
  ELSE 'personal'
END
WHERE folder_scope IS NULL;

ALTER TABLE document_folders
  ALTER COLUMN folder_scope SET DEFAULT 'personal',
  ALTER COLUMN folder_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'document_folders'
      AND constraint_name = 'document_folders_scope_check'
  ) THEN
    ALTER TABLE document_folders
      ADD CONSTRAINT document_folders_scope_check
      CHECK (folder_scope IN ('personal', 'company'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'document_folders'
      AND constraint_name = 'document_folders_scope_user_check'
  ) THEN
    ALTER TABLE document_folders
      ADD CONSTRAINT document_folders_scope_user_check
      CHECK (
        (folder_scope = 'personal' AND user_id IS NOT NULL)
        OR (folder_scope = 'company' AND user_id IS NULL)
      );
  END IF;
END $$;

DROP INDEX IF EXISTS document_folders_scope_name_idx;

CREATE UNIQUE INDEX IF NOT EXISTS document_folders_active_scope_name_idx
  ON document_folders (
    company_id,
    COALESCE(user_id, ''),
    COALESCE(parent_folder_id, ''),
    LOWER(name)
  )
  WHERE deleted_at IS NULL;

ALTER TABLE document_shares
  ALTER COLUMN shared_with_user_id DROP NOT NULL;

ALTER TABLE document_shares
  ADD COLUMN IF NOT EXISTS shared_with_role TEXT NULL,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'document_shares'
      AND constraint_name = 'document_shares_permission_check'
  ) THEN
    ALTER TABLE document_shares
      DROP CONSTRAINT document_shares_permission_check;
  END IF;

  ALTER TABLE document_shares
    ADD CONSTRAINT document_shares_permission_check
    CHECK (permission IN ('view', 'download', 'manage'));

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'document_shares'
      AND constraint_name = 'document_shares_target_check'
  ) THEN
    ALTER TABLE document_shares
      ADD CONSTRAINT document_shares_target_check
      CHECK (
        (shared_with_user_id IS NOT NULL AND shared_with_role IS NULL)
        OR (shared_with_user_id IS NULL AND shared_with_role IS NOT NULL)
      );
  END IF;
END $$;

DROP INDEX IF EXISTS document_shares_document_user_idx;

CREATE UNIQUE INDEX IF NOT EXISTS document_shares_active_user_target_idx
  ON document_shares (document_id, shared_with_user_id)
  WHERE revoked_at IS NULL
    AND shared_with_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_shares_active_role_target_idx
  ON document_shares (document_id, shared_with_role)
  WHERE revoked_at IS NULL
    AND shared_with_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_shares_role_created_idx
  ON document_shares (shared_with_role, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_company_wide BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE documents
SET is_company_wide = TRUE
WHERE user_id IS NULL;

UPDATE documents
SET is_company_wide = FALSE
WHERE user_id IS NOT NULL
  AND is_company_wide IS DISTINCT FROM FALSE;

CREATE INDEX IF NOT EXISTS documents_company_scope_created_idx
  ON documents (company_id, is_company_wide, created_at DESC);
