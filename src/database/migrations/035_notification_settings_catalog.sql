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
    'notification-rule-maintenance-mode-toggled',
    'system',
    'maintenance.mode.toggled',
    'Maintenance Mode Toggled',
    'When maintenance mode is enabled or disabled.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'critical',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-announcement-posted',
    'system',
    'announcement.posted',
    'Announcement Posted',
    'When a new announcement is published.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-backup-completed',
    'system',
    'backup.completed',
    'Backup Completed',
    'When a manual or scheduled backup finishes.',
    FALSE,
    ARRAY['in-app']::text[],
    'low',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-company-user-created',
    'users',
    'company.user.created',
    'New User Created',
    'When a new account is created in any company.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-company-user-deactivated',
    'users',
    'company.user.deactivated',
    'User Deactivated',
    'When a user account is deactivated.',
    TRUE,
    ARRAY['email']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-security-failed-login',
    'security',
    'security.failed-login',
    'Failed Login (3+ attempts)',
    'When a user fails to login 3 or more times.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-security-password-changed',
    'security',
    'security.password.changed',
    'Password Changed',
    'When a user changes their password.',
    TRUE,
    ARRAY['email']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-company-status-changed',
    'companies',
    'company.status.changed',
    'Company Status Changed',
    'When a company is activated or deactivated.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-module-toggled',
    'modules',
    'module.toggled',
    'Module Enabled/Disabled',
    'When a module is toggled for a company.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-leave-request-approved',
    'hr',
    'leave.request.approved',
    'Leave Request Approved',
    'When an employee''s leave request is approved.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-leave-request-rejected',
    'hr',
    'leave.request.rejected',
    'Leave Request Rejected',
    'When an employee''s leave request is rejected.',
    TRUE,
    ARRAY['email']::text[],
    'high',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-onboarding-completed',
    'hr',
    'onboarding.completed',
    'Onboarding Completed',
    'When an employee''s onboarding process is complete.',
    TRUE,
    ARRAY['in-app', 'email']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-asset-assigned',
    'assets',
    'asset.assigned',
    'Asset Assigned',
    'When a company asset is assigned to an employee.',
    TRUE,
    ARRAY['in-app']::text[],
    'medium',
    NOW(),
    NOW()
  ),
  (
    'notification-rule-payslip-generated',
    'payroll',
    'payslip.generated',
    'Payslip Generated',
    'When a payslip is generated after payroll processing.',
    TRUE,
    ARRAY['email']::text[],
    'medium',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  module = EXCLUDED.module,
  event_key = EXCLUDED.event_key,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  channels = EXCLUDED.channels,
  severity = EXCLUDED.severity,
  updated_at = NOW();

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
SELECT
  CONCAT('notification-policy-', REPLACE(event_key, '.', '-')),
  event_key,
  FALSE,
  NULL,
  1,
  FALSE,
  NULL,
  NOW(),
  NOW()
FROM notification_rules
WHERE event_key IN (
  'maintenance.mode.toggled',
  'announcement.posted',
  'backup.completed',
  'company.user.created',
  'company.user.deactivated',
  'security.failed-login',
  'security.password.changed',
  'company.status.changed',
  'module.toggled',
  'leave.request.approved',
  'leave.request.rejected',
  'onboarding.completed',
  'asset.assigned',
  'payslip.generated'
)
ON CONFLICT (id) DO NOTHING;
