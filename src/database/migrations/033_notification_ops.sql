CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in-app']::text[],
  severity TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_rules_severity_check
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT notification_rules_channels_check
    CHECK (channels <@ ARRAY['in-app', 'email', 'sms']::text[])
);

CREATE INDEX IF NOT EXISTS notification_rules_module_idx
  ON notification_rules (module, enabled, event_key);

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
    'notification-rule-leave-request-created',
    'leave',
    'leave.request.created',
    'Leave request created',
    'When a leave request is submitted and approvers need to be notified.',
    TRUE,
    ARRAY['in-app']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-leave-status-changed',
    'leave',
    'leave.status.changed',
    'Leave status changed',
    'When a leave request is approved or rejected and the requester is notified.',
    TRUE,
    ARRAY['in-app']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-leave-manager-reviewed',
    'leave',
    'leave.manager.reviewed',
    'Leave manager reviewed',
    'When manager review is recorded and the requester or HR need notification.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-asset-assigned',
    'assets',
    'asset.assigned',
    'Asset assigned',
    'When a company asset is assigned to a user.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-company-user-created',
    'users',
    'company.user.created',
    'Company user created',
    'When a company account is provisioned for a user.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_policies (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE
    REFERENCES notification_rules(event_key) ON DELETE CASCADE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_interval_minutes INTEGER NULL,
  max_retries INTEGER NOT NULL DEFAULT 1,
  escalation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_after_minutes INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_policies_max_retries_check
    CHECK (max_retries >= 0 AND max_retries <= 25),
  CONSTRAINT notification_policies_reminder_interval_check
    CHECK (
      reminder_interval_minutes IS NULL OR
      reminder_interval_minutes BETWEEN 1 AND 10080
    ),
  CONSTRAINT notification_policies_escalation_after_check
    CHECK (
      escalation_after_minutes IS NULL OR
      escalation_after_minutes BETWEEN 1 AND 10080
    )
);

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
    'notification-policy-leave-request-created',
    'leave.request.created',
    TRUE,
    60,
    2,
    TRUE,
    240,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-leave-status-changed',
    'leave.status.changed',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-leave-manager-reviewed',
    'leave.manager.reviewed',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-asset-assigned',
    'asset.assigned',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'notification-policy-company-user-created',
    'company.user.created',
    FALSE,
    NULL,
    1,
    FALSE,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id TEXT PRIMARY KEY,
  notification_id TEXT NULL REFERENCES notifications(id) ON DELETE SET NULL,
  company_id TEXT NULL REFERENCES companies(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_delivery_logs_channel_check
    CHECK (channel IN ('in-app', 'email', 'sms')),
  CONSTRAINT notification_delivery_logs_status_check
    CHECK (status IN ('delivered', 'failed', 'pending', 'retry-queued')),
  CONSTRAINT notification_delivery_logs_attempts_check
    CHECK (attempts >= 0 AND attempts <= 100)
);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_status_idx
  ON notification_delivery_logs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_channel_idx
  ON notification_delivery_logs (channel, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_company_idx
  ON notification_delivery_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_event_idx
  ON notification_delivery_logs (event_key, created_at DESC);
