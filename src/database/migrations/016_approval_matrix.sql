CREATE TABLE IF NOT EXISTS approval_flows (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_flows_entity_type_check
    CHECK (entity_type IN ('leave'))
);

CREATE UNIQUE INDEX IF NOT EXISTS approval_flows_active_unique_idx
  ON approval_flows (company_id, entity_type)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS approval_flows_company_entity_idx
  ON approval_flows (company_id, entity_type, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  role TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_steps_step_order_check
    CHECK (step_order > 0),
  CONSTRAINT approval_steps_role_check
    CHECK (role IN ('manager', 'admin', 'hr', 'accounts', 'project-manager', 'team-lead', 'employee')),
  UNIQUE (flow_id, step_order)
);

CREATE INDEX IF NOT EXISTS approval_steps_flow_id_idx
  ON approval_steps (flow_id);

CREATE INDEX IF NOT EXISTS approval_steps_flow_order_idx
  ON approval_steps (flow_id, step_order);

CREATE TABLE IF NOT EXISTS approval_records (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  step_id TEXT NOT NULL REFERENCES approval_steps(id) ON DELETE CASCADE,
  approver_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  acted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_records_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  UNIQUE (entity_type, entity_id, step_id)
);

CREATE INDEX IF NOT EXISTS approval_records_entity_idx
  ON approval_records (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS approval_records_step_id_idx
  ON approval_records (step_id);

INSERT INTO approval_flows (
  id,
  company_id,
  entity_type,
  name,
  is_active,
  created_at,
  updated_at
)
SELECT
  companies.id || ':leave:flow:v1',
  companies.id,
  'leave',
  'Leave Approval Flow',
  TRUE,
  NOW(),
  NOW()
FROM companies
WHERE NOT EXISTS (
  SELECT 1
  FROM approval_flows AS existing_flow
  WHERE existing_flow.company_id = companies.id
    AND existing_flow.entity_type = 'leave'
    AND existing_flow.is_active = TRUE
);

INSERT INTO approval_steps (
  id,
  flow_id,
  step_order,
  role,
  is_required,
  created_at,
  updated_at
)
SELECT
  flow.id || ':step:manager',
  flow.id,
  1,
  'manager',
  TRUE,
  NOW(),
  NOW()
FROM approval_flows AS flow
WHERE flow.entity_type = 'leave'
  AND flow.is_active = TRUE
ON CONFLICT (flow_id, step_order) DO NOTHING;

INSERT INTO approval_steps (
  id,
  flow_id,
  step_order,
  role,
  is_required,
  created_at,
  updated_at
)
SELECT
  flow.id || ':step:hr',
  flow.id,
  2,
  'hr',
  TRUE,
  NOW(),
  NOW()
FROM approval_flows AS flow
WHERE flow.entity_type = 'leave'
  AND flow.is_active = TRUE
ON CONFLICT (flow_id, step_order) DO NOTHING;

INSERT INTO approval_records (
  id,
  entity_type,
  entity_id,
  step_id,
  approver_id,
  status,
  acted_at,
  created_at,
  updated_at
)
SELECT
  leave_requests.id || ':approval:manager',
  'leave',
  leave_requests.id,
  manager_step.id,
  leave_requests.manager_reviewed_by_user_id,
  CASE
    WHEN leave_requests.manager_review_status = 'rejected' THEN 'rejected'
    WHEN leave_requests.manager_review_status IN ('approved', 'forwarded') THEN 'approved'
    ELSE 'pending'
  END,
  leave_requests.manager_reviewed_at,
  NOW(),
  NOW()
FROM leave_requests
INNER JOIN approval_flows AS flow
  ON flow.company_id = leave_requests.company_id
  AND flow.entity_type = 'leave'
  AND flow.is_active = TRUE
INNER JOIN approval_steps AS manager_step
  ON manager_step.flow_id = flow.id
  AND manager_step.step_order = 1
ON CONFLICT (entity_type, entity_id, step_id) DO NOTHING;

INSERT INTO approval_records (
  id,
  entity_type,
  entity_id,
  step_id,
  approver_id,
  status,
  acted_at,
  created_at,
  updated_at
)
SELECT
  leave_requests.id || ':approval:hr',
  'leave',
  leave_requests.id,
  hr_step.id,
  NULL,
  CASE
    WHEN leave_requests.manager_review_status IN ('approved', 'forwarded')
      AND leave_requests.status = 'approved'
      THEN 'approved'
    WHEN leave_requests.manager_review_status IN ('approved', 'forwarded')
      AND leave_requests.status = 'rejected'
      THEN 'rejected'
    ELSE 'pending'
  END,
  CASE
    WHEN leave_requests.manager_review_status IN ('approved', 'forwarded')
      AND leave_requests.status IN ('approved', 'rejected')
      THEN leave_requests.updated_at
    ELSE NULL
  END,
  NOW(),
  NOW()
FROM leave_requests
INNER JOIN approval_flows AS flow
  ON flow.company_id = leave_requests.company_id
  AND flow.entity_type = 'leave'
  AND flow.is_active = TRUE
INNER JOIN approval_steps AS hr_step
  ON hr_step.flow_id = flow.id
  AND hr_step.step_order = 2
ON CONFLICT (entity_type, entity_id, step_id) DO NOTHING;
