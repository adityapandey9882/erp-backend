CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  milestone_type TEXT NOT NULL DEFAULT 'internal',
  phase TEXT NOT NULL DEFAULT 'Planning',
  status TEXT NOT NULL DEFAULT 'upcoming',
  priority TEXT NOT NULL DEFAULT 'medium',
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_date DATE NULL,
  due_date DATE NOT NULL,
  target_completion_date DATE NULL,
  completed_at TIMESTAMPTZ NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  baseline_progress INTEGER NULL,
  completion_criteria TEXT NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT project_milestones_type_check
    CHECK (milestone_type IN ('internal', 'client', 'release', 'delivery', 'review', 'support')),
  CONSTRAINT project_milestones_status_check
    CHECK (status IN ('upcoming', 'on_track', 'at_risk', 'delayed', 'completed', 'cancelled')),
  CONSTRAINT project_milestones_priority_check
    CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT project_milestones_progress_check
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  CONSTRAINT project_milestones_baseline_progress_check
    CHECK (baseline_progress IS NULL OR (baseline_progress >= 0 AND baseline_progress <= 100)),
  UNIQUE (company_id, milestone_code)
);

CREATE INDEX IF NOT EXISTS project_milestones_company_project_status_idx
  ON project_milestones (company_id, project_id, status, due_date)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS project_milestones_company_owner_idx
  ON project_milestones (company_id, owner_id, status, due_date)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS project_milestones_company_priority_idx
  ON project_milestones (company_id, priority, due_date)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS project_milestone_dependencies (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  depends_on_milestone_id TEXT NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks',
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_milestone_dependencies_type_check
    CHECK (dependency_type IN ('blocks', 'relates_to', 'follows')),
  CONSTRAINT project_milestone_dependencies_no_self_check
    CHECK (milestone_id <> depends_on_milestone_id),
  UNIQUE (company_id, milestone_id, depends_on_milestone_id)
);

CREATE INDEX IF NOT EXISTS project_milestone_dependencies_milestone_idx
  ON project_milestone_dependencies (company_id, milestone_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_milestone_dependencies_depends_on_idx
  ON project_milestone_dependencies (company_id, depends_on_milestone_id);

CREATE TABLE IF NOT EXISTS project_milestone_activity_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  actor_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_milestone_activity_logs_milestone_idx
  ON project_milestone_activity_logs (company_id, milestone_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_milestone_attachments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  uploaded_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, milestone_id, document_id)
);

CREATE INDEX IF NOT EXISTS project_milestone_attachments_milestone_idx
  ON project_milestone_attachments (company_id, milestone_id, created_at DESC);

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS milestone_id TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'project_tasks'
      AND constraint_name = 'project_tasks_milestone_id_fkey'
  ) THEN
    ALTER TABLE project_tasks
      ADD CONSTRAINT project_tasks_milestone_id_fkey
      FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_tasks_company_milestone_idx
  ON project_tasks (company_id, milestone_id, status, due_date)
  WHERE archived_at IS NULL AND milestone_id IS NOT NULL;
