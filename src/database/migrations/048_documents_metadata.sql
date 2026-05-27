ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS file_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS mime_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NULL,
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

UPDATE documents
SET download_count = 0
WHERE download_count IS NULL;

CREATE INDEX IF NOT EXISTS documents_company_downloads_idx
  ON documents (company_id, download_count DESC, created_at DESC);
