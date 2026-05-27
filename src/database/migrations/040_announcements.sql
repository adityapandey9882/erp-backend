CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('HR', 'IT', 'Admin', 'Facilities', 'Finance', 'Others')
  ),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (
    priority IN ('High', 'Medium', 'Low')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'draft', 'archived')
  ),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_company_status_idx
  ON announcements(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS announcements_company_published_idx
  ON announcements(company_id, published_at DESC);

CREATE INDEX IF NOT EXISTS announcements_company_category_idx
  ON announcements(company_id, category);

CREATE INDEX IF NOT EXISTS announcements_company_priority_idx
  ON announcements(company_id, priority);
