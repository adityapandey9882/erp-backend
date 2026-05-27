CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL,
  name TEXT NOT NULL,
  client_name TEXT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date DATE NULL,
  due_date DATE NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  project_manager_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  budget_amount NUMERIC(14, 2) NULL,
  spent_amount NUMERIC(14, 2) NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT projects_status_check
    CHECK (status IN ('not_started', 'on_track', 'at_risk', 'on_hold', 'completed', 'archived')),
  CONSTRAINT projects_priority_check
    CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT projects_progress_percent_check
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  UNIQUE (company_id, project_code)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE projects
      ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS project_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_manager_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(14, 2) NULL,
  ADD COLUMN IF NOT EXISTS spent_amount NUMERIC(14, 2) NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'owner_name'
  ) THEN
    UPDATE projects
    SET owner_name = 'Project Manager'
    WHERE owner_name IS NULL
       OR BTRIM(owner_name) = '';

    ALTER TABLE projects
      ALTER COLUMN owner_name SET DEFAULT 'Project Manager';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'owner_email'
  ) THEN
    UPDATE projects
    SET owner_email = 'project-manager@companyerp.local'
    WHERE owner_email IS NULL
       OR BTRIM(owner_email) = '';

    ALTER TABLE projects
      ALTER COLUMN owner_email SET DEFAULT 'project-manager@companyerp.local';
  END IF;
END $$;

UPDATE projects
SET company_id = (
  SELECT companies.id
  FROM companies
  ORDER BY companies.created_at ASC
  LIMIT 1
)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies);

WITH numbered_projects AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + 1000 AS sequence_number
  FROM projects
  WHERE project_code IS NULL
     OR BTRIM(project_code) = ''
)
UPDATE projects
SET project_code = CONCAT('PRJ-', numbered_projects.sequence_number)
FROM numbered_projects
WHERE projects.id = numbered_projects.id;

UPDATE projects
SET status = CASE
  WHEN status IN ('not_started', 'on_track', 'at_risk', 'on_hold', 'completed', 'archived') THEN status
  WHEN status IN ('active', 'in_progress', 'open') THEN 'on_track'
  WHEN status IN ('paused', 'hold') THEN 'on_hold'
  WHEN status IN ('done', 'closed') THEN 'completed'
  ELSE 'not_started'
END
WHERE status IS NULL
   OR status NOT IN ('not_started', 'on_track', 'at_risk', 'on_hold', 'completed', 'archived');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      DROP CONSTRAINT projects_status_check;
  END IF;

  ALTER TABLE projects
    ADD CONSTRAINT projects_status_check
    CHECK (status IN ('not_started', 'on_track', 'at_risk', 'on_hold', 'completed', 'archived'))
    NOT VALID;
END $$;

UPDATE projects
SET priority = 'medium'
WHERE priority IS NULL
   OR priority NOT IN ('low', 'medium', 'high');

UPDATE projects
SET progress_percent = GREATEST(0, LEAST(100, progress_percent));

ALTER TABLE projects
  ALTER COLUMN project_code SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'not_started',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN progress_percent SET DEFAULT 0,
  ALTER COLUMN progress_percent SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM projects
    WHERE company_id IS NULL
  ) THEN
    ALTER TABLE projects
      ALTER COLUMN company_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_company_id_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_project_manager_id_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_project_manager_id_fkey
      FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_created_by_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('not_started', 'on_track', 'at_risk', 'on_hold', 'completed', 'archived'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_priority_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_priority_check
      CHECK (priority IN ('low', 'medium', 'high'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_progress_percent_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_progress_percent_check
      CHECK (progress_percent >= 0 AND progress_percent <= 100)
      NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS projects_company_project_code_idx
  ON projects (company_id, project_code)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_company_status_idx
  ON projects (company_id, status, due_date);

CREATE INDEX IF NOT EXISTS projects_company_manager_idx
  ON projects (company_id, project_manager_id, archived_at);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL,
  allocation_percent INTEGER NOT NULL DEFAULT 100,
  capacity_hours_per_week INTEGER NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_members_allocation_percent_check
    CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  CONSTRAINT project_members_capacity_check
    CHECK (capacity_hours_per_week IS NULL OR capacity_hours_per_week >= 0),
  UNIQUE (company_id, project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_company_user_idx
  ON project_members (company_id, user_id, is_active);

CREATE INDEX IF NOT EXISTS project_members_project_active_idx
  ON project_members (company_id, project_id, is_active);

CREATE TABLE IF NOT EXISTS project_tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reporter_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  estimated_minutes INTEGER NULL,
  spent_minutes INTEGER NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT project_tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'blocked')),
  CONSTRAINT project_tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT project_tasks_progress_percent_check
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  CONSTRAINT project_tasks_estimated_minutes_check
    CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  CONSTRAINT project_tasks_spent_minutes_check
    CHECK (spent_minutes IS NULL OR spent_minutes >= 0),
  UNIQUE (company_id, task_code)
);

CREATE INDEX IF NOT EXISTS project_tasks_company_project_status_idx
  ON project_tasks (company_id, project_id, status, due_date)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS project_tasks_company_assignee_idx
  ON project_tasks (company_id, assignee_id, status, due_date)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS project_tasks_company_priority_idx
  ON project_tasks (company_id, priority, due_date)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS project_task_checklist_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_task_checklist_items_task_idx
  ON project_task_checklist_items (company_id, task_id, created_at);

CREATE TABLE IF NOT EXISTS project_task_comments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  parent_comment_id TEXT NULL REFERENCES project_task_comments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS project_task_comments_task_idx
  ON project_task_comments (company_id, task_id, created_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_task_activity_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  actor_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_task_activity_logs_task_idx
  ON project_task_activity_logs (company_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_task_attachments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  uploaded_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, task_id, document_id)
);

CREATE INDEX IF NOT EXISTS project_task_attachments_task_idx
  ON project_task_attachments (company_id, task_id, created_at DESC);
