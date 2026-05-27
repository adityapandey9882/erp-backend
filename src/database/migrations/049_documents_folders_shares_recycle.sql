ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS document_storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS document_storage_quota_bytes BIGINT NULL;

CREATE TABLE IF NOT EXISTS document_folders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  parent_folder_id TEXT NULL REFERENCES document_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_folders_company_user_idx
  ON document_folders (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_folders_company_parent_idx
  ON document_folders (company_id, parent_folder_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS document_folders_scope_name_idx
  ON document_folders (
    company_id,
    COALESCE(user_id, ''),
    COALESCE(parent_folder_id, ''),
    LOWER(name)
  );

CREATE TABLE IF NOT EXISTS document_shares (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_with_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_shares_permission_check
    CHECK (permission IN ('view', 'download'))
);

CREATE UNIQUE INDEX IF NOT EXISTS document_shares_document_user_idx
  ON document_shares (document_id, shared_with_user_id);

CREATE INDEX IF NOT EXISTS document_shares_user_created_idx
  ON document_shares (shared_with_user_id, created_at DESC);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS folder_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND constraint_name = 'documents_folder_id_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND constraint_name = 'documents_deleted_by_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_company_folder_created_idx
  ON documents (company_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_company_deleted_idx
  ON documents (company_id, deleted_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_company_user_deleted_idx
  ON documents (company_id, user_id, deleted_at DESC, created_at DESC);
