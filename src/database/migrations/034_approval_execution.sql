CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL REFERENCES approval_flows(id) ON DELETE RESTRICT,
  module TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_requests_status_check
    CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected')),
  CONSTRAINT approval_requests_current_step_check
    CHECK (current_step > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS approval_requests_company_module_entity_unique_idx
  ON approval_requests (company_id, module, entity_id);

CREATE INDEX IF NOT EXISTS approval_requests_company_status_idx
  ON approval_requests (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS approval_requests_company_step_idx
  ON approval_requests (company_id, current_step, updated_at DESC);

ALTER TABLE approval_records
  ADD COLUMN IF NOT EXISTS request_id TEXT NULL REFERENCES approval_requests(id) ON DELETE CASCADE;

ALTER TABLE approval_records
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL;

CREATE INDEX IF NOT EXISTS approval_records_request_id_idx
  ON approval_records (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS approval_records_approver_id_idx
  ON approval_records (approver_id, status, created_at DESC);

WITH request_source AS (
  SELECT
    flows.company_id,
    records.entity_type AS module,
    records.entity_id,
    MIN(records.created_at) AS created_at,
    MAX(records.updated_at) AS updated_at,
    COUNT(*) FILTER (WHERE records.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE records.status = 'rejected') AS rejected_count,
    COUNT(*)::int AS total_steps
  FROM approval_records AS records
  INNER JOIN approval_steps AS steps
    ON steps.id = records.step_id
  INNER JOIN approval_flows AS flows
    ON flows.id = steps.flow_id
  GROUP BY flows.company_id, records.entity_type, records.entity_id
)
INSERT INTO approval_requests (
  id,
  company_id,
  flow_id,
  module,
  entity_id,
  status,
  current_step,
  created_by,
  created_at,
  updated_at
)
SELECT
  request_source.company_id || ':' || request_source.module || ':' || request_source.entity_id || ':request',
  request_source.company_id,
  (
    SELECT steps.flow_id
    FROM approval_records AS records
    INNER JOIN approval_steps AS steps
      ON steps.id = records.step_id
    INNER JOIN approval_flows AS flows
      ON flows.id = steps.flow_id
    WHERE flows.company_id = request_source.company_id
      AND records.entity_type = request_source.module
      AND records.entity_id = request_source.entity_id
    ORDER BY steps.step_order ASC
    LIMIT 1
  ),
  request_source.module,
  request_source.entity_id,
  CASE
    WHEN request_source.rejected_count > 0 THEN 'rejected'
    WHEN request_source.approved_count = request_source.total_steps AND request_source.total_steps > 0 THEN 'approved'
    WHEN request_source.approved_count > 0 THEN 'in_progress'
    ELSE 'pending'
  END,
  CASE
    WHEN request_source.rejected_count > 0 THEN COALESCE(
      (
        SELECT steps.step_order
        FROM approval_records AS records
        INNER JOIN approval_steps AS steps
          ON steps.id = records.step_id
        INNER JOIN approval_flows AS flows
          ON flows.id = steps.flow_id
        WHERE flows.company_id = request_source.company_id
          AND records.entity_type = request_source.module
          AND records.entity_id = request_source.entity_id
          AND records.status = 'rejected'
        ORDER BY steps.step_order ASC
        LIMIT 1
      ),
      1
    )
    WHEN request_source.approved_count = request_source.total_steps AND request_source.total_steps > 0 THEN request_source.total_steps
    WHEN request_source.approved_count > 0 THEN request_source.approved_count + 1
    ELSE 1
  END,
  NULL,
  request_source.created_at,
  request_source.updated_at
FROM request_source
ON CONFLICT (company_id, module, entity_id) DO NOTHING;

WITH mapped_records AS (
  SELECT
    records.id AS record_id,
    req.id AS request_id
  FROM approval_records AS records
  INNER JOIN approval_steps AS steps
    ON steps.id = records.step_id
  INNER JOIN approval_flows AS flows
    ON flows.id = steps.flow_id
  INNER JOIN approval_requests AS req
    ON req.company_id = flows.company_id
    AND req.module = records.entity_type
    AND req.entity_id = records.entity_id
)
UPDATE approval_records AS records
SET request_id = mapped_records.request_id
FROM mapped_records
WHERE records.id = mapped_records.record_id;

INSERT INTO notification_rules (
  id,
  module,
  event_key,
  label,
  description,
  enabled,
  channels,
  severity,
  created_at,
  updated_at
)
VALUES
  (
    'notification-rule-approval-request-assigned',
    'approvals',
    'approval.request.assigned',
    'Approval request assigned',
    'When a request is assigned to a real approver and awaits action.',
    TRUE,
    ARRAY['in-app']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-approval-completed',
    'approvals',
    'approval.completed',
    'Approval completed',
    'When an approval request is fully approved and completed.',
    TRUE,
    ARRAY['in-app']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-approval-rejected',
    'approvals',
    'approval.rejected',
    'Approval rejected',
    'When an approval request is rejected at any step.',
    TRUE,
    ARRAY['in-app']::text[],
    'high',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_policies (
  id,
  event_key,
  reminder_enabled,
  reminder_interval_minutes,
  max_retries,
  escalation_enabled,
  escalation_after_minutes,
  created_at,
  updated_at
)
VALUES
  (
    'notification-policy-approval-request-assigned',
    'approval.request.assigned',
    TRUE,
    60,
    2,
    TRUE,
    240,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-approval-completed',
    'approval.completed',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-approval-rejected',
    'approval.rejected',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
