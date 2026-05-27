import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { DatabaseExecutor } from "../../database/index.js";
import { query } from "../../database/index.js";
import type {
  CreateNotificationDeliveryLogInput,
  NotificationDeliveryChannel,
  NotificationDeliveryLogFilters,
  NotificationDeliveryLogsResponse,
  NotificationDeliveryLogView,
  NotificationDeliveryStatus,
  NotificationHealthResponse,
  NotificationPoliciesResponse,
  NotificationPolicyView,
  NotificationRuleView,
  NotificationRulesResponse,
  NotificationRuleSeverity,
  UpdateNotificationPolicyRequest,
  UpdateNotificationRuleRequest,
} from "./notification-ops.types.js";
import type { NotificationType } from "./notifications.types.js";

type NotificationRuleRow = {
  id: string;
  module: string;
  eventKey: string;
  label: string;
  description: string;
  enabled: boolean;
  channels: string[];
  severity: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type NotificationPolicyRow = {
  id: string;
  eventKey: string;
  label: string;
  module: string;
  reminderEnabled: boolean;
  reminderIntervalMinutes: number | null;
  maxRetries: number;
  escalationEnabled: boolean;
  escalationAfterMinutes: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type NotificationDeliveryLogRow = {
  id: string;
  notificationId: string | null;
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  eventKey: string;
  channel: string;
  status: string;
  errorMessage: string | null;
  attempts: number;
  lastAttemptAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata: Record<string, unknown> | null;
};

type StatusCountRow = {
  status: NotificationDeliveryStatus;
  total: string;
};

type ChannelHealthRow = {
  channel: NotificationDeliveryChannel;
  total: string;
  delivered: string;
  failed: string;
  pending: string;
  retryQueued: string;
};

type DefaultNotificationRuleDefinition = {
  id: string;
  module: string;
  eventKey: NotificationType;
  label: string;
  description: string;
  enabled: boolean;
  channels: NotificationDeliveryChannel[];
  severity: NotificationRuleSeverity;
};

const DEFAULT_NOTIFICATION_RULES: DefaultNotificationRuleDefinition[] = [
  {
    id: "notification-rule-maintenance-mode-toggled",
    module: "system",
    eventKey: "maintenance.mode.toggled",
    label: "Maintenance Mode Toggled",
    description: "When maintenance mode is enabled or disabled.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "critical",
  },
  {
    id: "notification-rule-announcement-posted",
    module: "system",
    eventKey: "announcement.posted",
    label: "Announcement Posted",
    description: "When a new announcement is published.",
    enabled: true,
    channels: ["in-app"],
    severity: "medium",
  },
  {
    id: "notification-rule-backup-completed",
    module: "system",
    eventKey: "backup.completed",
    label: "Backup Completed",
    description: "When a manual or scheduled backup finishes.",
    enabled: false,
    channels: ["in-app"],
    severity: "low",
  },
  {
    id: "notification-rule-company-user-created",
    module: "users",
    eventKey: "company.user.created",
    label: "New User Created",
    description: "When a new account is created in any company.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "medium",
  },
  {
    id: "notification-rule-company-user-deactivated",
    module: "users",
    eventKey: "company.user.deactivated",
    label: "User Deactivated",
    description: "When a user account is deactivated.",
    enabled: true,
    channels: ["email"],
    severity: "medium",
  },
  {
    id: "notification-rule-security-failed-login",
    module: "security",
    eventKey: "security.failed-login",
    label: "Failed Login (3+ attempts)",
    description: "When a user fails to login 3 or more times.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "high",
  },
  {
    id: "notification-rule-security-password-changed",
    module: "security",
    eventKey: "security.password.changed",
    label: "Password Changed",
    description: "When a user changes their password.",
    enabled: true,
    channels: ["email"],
    severity: "medium",
  },
  {
    id: "notification-rule-company-status-changed",
    module: "companies",
    eventKey: "company.status.changed",
    label: "Company Status Changed",
    description: "When a company is activated or deactivated.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "high",
  },
  {
    id: "notification-rule-module-toggled",
    module: "modules",
    eventKey: "module.toggled",
    label: "Module Enabled/Disabled",
    description: "When a module is toggled for a company.",
    enabled: true,
    channels: ["in-app"],
    severity: "medium",
  },
  {
    id: "notification-rule-leave-request-approved",
    module: "hr",
    eventKey: "leave.request.approved",
    label: "Leave Request Approved",
    description: "When an employee's leave request is approved.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "high",
  },
  {
    id: "notification-rule-leave-request-rejected",
    module: "hr",
    eventKey: "leave.request.rejected",
    label: "Leave Request Rejected",
    description: "When an employee's leave request is rejected.",
    enabled: true,
    channels: ["email"],
    severity: "high",
  },
  {
    id: "notification-rule-onboarding-completed",
    module: "hr",
    eventKey: "onboarding.completed",
    label: "Onboarding Completed",
    description: "When an employee's onboarding process is complete.",
    enabled: true,
    channels: ["in-app", "email"],
    severity: "medium",
  },
  {
    id: "notification-rule-asset-assigned",
    module: "assets",
    eventKey: "asset.assigned",
    label: "Asset Assigned",
    description: "When a company asset is assigned to an employee.",
    enabled: true,
    channels: ["in-app"],
    severity: "medium",
  },
  {
    id: "notification-rule-payslip-generated",
    module: "payroll",
    eventKey: "payslip.generated",
    label: "Payslip Generated",
    description: "When a payslip is generated after payroll processing.",
    enabled: true,
    channels: ["email"],
    severity: "medium",
  },
];

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRuleRow(row: NotificationRuleRow): NotificationRuleView {
  return {
    id: row.id,
    module: row.module,
    eventKey: row.eventKey as NotificationType,
    label: row.label,
    description: row.description,
    enabled: row.enabled,
    channels: row.channels.filter(
      (channel): channel is NotificationDeliveryChannel =>
        channel === "in-app" || channel === "email" || channel === "sms",
    ),
    severity: row.severity as NotificationRuleSeverity,
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapPolicyRow(row: NotificationPolicyRow): NotificationPolicyView {
  return {
    id: row.id,
    eventKey: row.eventKey as NotificationType,
    label: row.label,
    module: row.module,
    reminderEnabled: row.reminderEnabled,
    reminderIntervalMinutes: row.reminderIntervalMinutes,
    maxRetries: row.maxRetries,
    escalationEnabled: row.escalationEnabled,
    escalationAfterMinutes: row.escalationAfterMinutes,
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapDeliveryLogRow(row: NotificationDeliveryLogRow): NotificationDeliveryLogView {
  return {
    id: row.id,
    notificationId: row.notificationId,
    company:
      row.companyId && row.companyName && row.companyCode
        ? {
            id: row.companyId,
            name: row.companyName,
            code: row.companyCode,
          }
        : null,
    eventKey: row.eventKey as NotificationType,
    channel: row.channel as NotificationDeliveryChannel,
    status: row.status as NotificationDeliveryStatus,
    errorMessage: row.errorMessage,
    attempts: row.attempts,
    lastAttemptAt: toIsoString(row.lastAttemptAt),
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString(),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
  };
}

function buildDeliveryLogFilters(
  filters: NotificationDeliveryLogFilters,
  includeOnlyFailed = false,
) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (includeOnlyFailed) {
    conditions.push(`ndl.status IN ('failed', 'retry-queued')`);
  } else if (filters.status) {
    values.push(filters.status);
    conditions.push(`ndl.status = $${values.length}`);
  }

  if (filters.channel) {
    values.push(filters.channel);
    conditions.push(`ndl.channel = $${values.length}`);
  }

  if (filters.companyId) {
    values.push(filters.companyId);
    conditions.push(`ndl.company_id = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`ndl.created_at >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`ndl.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

function buildPagination(page = 1, pageSize = 20) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20;

  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}

async function ensureDefaultNotificationCatalog() {
  for (const rule of DEFAULT_NOTIFICATION_RULES) {
    await query(
      `
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
        VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, NOW(), NOW())
        ON CONFLICT (event_key) DO UPDATE
        SET
          id = EXCLUDED.id,
          module = EXCLUDED.module,
          label = EXCLUDED.label,
          description = EXCLUDED.description
      `,
      [
        rule.id,
        rule.module,
        rule.eventKey,
        rule.label,
        rule.description,
        rule.enabled,
        rule.channels,
        rule.severity,
      ],
    );

    await query(
      `
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
        VALUES ($1, $2, FALSE, NULL, 1, FALSE, NULL, NOW(), NOW())
        ON CONFLICT (event_key) DO NOTHING
      `,
      [
        `notification-policy-${rule.eventKey.replace(/\./g, "-")}`,
        rule.eventKey,
      ],
    );
  }
}

async function listRulesWithExecutor(executor: DatabaseExecutor) {
  const result = await executor.query<NotificationRuleRow>(
    `
      SELECT
        id,
        module,
        event_key AS "eventKey",
        label,
        description,
        enabled,
        channels,
        severity,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM notification_rules
      ORDER BY module ASC, label ASC
    `,
  );

  return result.rows.map(mapRuleRow);
}

async function listPoliciesWithExecutor(executor: DatabaseExecutor) {
  const result = await executor.query<NotificationPolicyRow>(
    `
      SELECT
        np.id,
        np.event_key AS "eventKey",
        nr.label,
        nr.module,
        np.reminder_enabled AS "reminderEnabled",
        np.reminder_interval_minutes AS "reminderIntervalMinutes",
        np.max_retries AS "maxRetries",
        np.escalation_enabled AS "escalationEnabled",
        np.escalation_after_minutes AS "escalationAfterMinutes",
        np.created_at AS "createdAt",
        np.updated_at AS "updatedAt"
      FROM notification_policies np
      INNER JOIN notification_rules nr
        ON nr.event_key = np.event_key
      ORDER BY nr.module ASC, nr.label ASC
    `,
  );

  return result.rows.map(mapPolicyRow);
}

export const notificationOpsRepository = {
  async listRules(): Promise<NotificationRuleView[]> {
    await ensureDefaultNotificationCatalog();
    return listRulesWithExecutor({ query });
  },

  async findRuleById(ruleId: string) {
    await ensureDefaultNotificationCatalog();
    const result = await query<NotificationRuleRow>(
      `
        SELECT
          id,
          module,
          event_key AS "eventKey",
          label,
          description,
          enabled,
          channels,
          severity,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM notification_rules
        WHERE id = $1
      `,
      [ruleId],
    );

    return result.rows[0] ? mapRuleRow(result.rows[0]) : null;
  },

  async findRuleByEventKey(eventKey: NotificationType) {
    await ensureDefaultNotificationCatalog();
    const result = await query<NotificationRuleRow>(
      `
        SELECT
          id,
          module,
          event_key AS "eventKey",
          label,
          description,
          enabled,
          channels,
          severity,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM notification_rules
        WHERE event_key = $1
      `,
      [eventKey],
    );

    return result.rows[0] ? mapRuleRow(result.rows[0]) : null;
  },

  async updateRule(ruleId: string, input: UpdateNotificationRuleRequest) {
    const result = await query<NotificationRuleRow>(
      `
        UPDATE notification_rules
        SET
          enabled = COALESCE($2, enabled),
          channels = COALESCE($3, channels),
          severity = COALESCE($4, severity),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          module,
          event_key AS "eventKey",
          label,
          description,
          enabled,
          channels,
          severity,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        ruleId,
        typeof input.enabled === "boolean" ? input.enabled : null,
        input.channels ?? null,
        input.severity ?? null,
      ],
    );

    return result.rows[0] ? mapRuleRow(result.rows[0]) : null;
  },

  async listPolicies(): Promise<NotificationPolicyView[]> {
    await ensureDefaultNotificationCatalog();
    return listPoliciesWithExecutor({ query });
  },

  async findPolicyById(policyId: string) {
    await ensureDefaultNotificationCatalog();
    const result = await query<NotificationPolicyRow>(
      `
        SELECT
          np.id,
          np.event_key AS "eventKey",
          nr.label,
          nr.module,
          np.reminder_enabled AS "reminderEnabled",
          np.reminder_interval_minutes AS "reminderIntervalMinutes",
          np.max_retries AS "maxRetries",
          np.escalation_enabled AS "escalationEnabled",
          np.escalation_after_minutes AS "escalationAfterMinutes",
          np.created_at AS "createdAt",
          np.updated_at AS "updatedAt"
        FROM notification_policies np
        INNER JOIN notification_rules nr
          ON nr.event_key = np.event_key
        WHERE np.id = $1
      `,
      [policyId],
    );

    return result.rows[0] ? mapPolicyRow(result.rows[0]) : null;
  },

  async findPolicyByEventKey(eventKey: NotificationType) {
    await ensureDefaultNotificationCatalog();
    const result = await query<NotificationPolicyRow>(
      `
        SELECT
          np.id,
          np.event_key AS "eventKey",
          nr.label,
          nr.module,
          np.reminder_enabled AS "reminderEnabled",
          np.reminder_interval_minutes AS "reminderIntervalMinutes",
          np.max_retries AS "maxRetries",
          np.escalation_enabled AS "escalationEnabled",
          np.escalation_after_minutes AS "escalationAfterMinutes",
          np.created_at AS "createdAt",
          np.updated_at AS "updatedAt"
        FROM notification_policies np
        INNER JOIN notification_rules nr
          ON nr.event_key = np.event_key
        WHERE np.event_key = $1
      `,
      [eventKey],
    );

    return result.rows[0] ? mapPolicyRow(result.rows[0]) : null;
  },

  async updatePolicy(policyId: string, input: UpdateNotificationPolicyRequest) {
    const result = await query<NotificationPolicyRow>(
      `
        UPDATE notification_policies
        SET
          reminder_enabled = COALESCE($2, reminder_enabled),
          reminder_interval_minutes = CASE
            WHEN $2 = FALSE THEN NULL
            WHEN $3::integer IS NULL THEN reminder_interval_minutes
            ELSE $3::integer
          END,
          max_retries = COALESCE($4::integer, max_retries),
          escalation_enabled = COALESCE($5, escalation_enabled),
          escalation_after_minutes = CASE
            WHEN $5 = FALSE THEN NULL
            WHEN $6::integer IS NULL THEN escalation_after_minutes
            ELSE $6::integer
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          event_key AS "eventKey",
          (SELECT label FROM notification_rules WHERE event_key = notification_policies.event_key) AS label,
          (SELECT module FROM notification_rules WHERE event_key = notification_policies.event_key) AS module,
          reminder_enabled AS "reminderEnabled",
          reminder_interval_minutes AS "reminderIntervalMinutes",
          max_retries AS "maxRetries",
          escalation_enabled AS "escalationEnabled",
          escalation_after_minutes AS "escalationAfterMinutes",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        policyId,
        typeof input.reminderEnabled === "boolean" ? input.reminderEnabled : null,
        typeof input.reminderIntervalMinutes === "number" ||
        input.reminderIntervalMinutes === null
          ? input.reminderIntervalMinutes
          : null,
        typeof input.maxRetries === "number" ? input.maxRetries : null,
        typeof input.escalationEnabled === "boolean"
          ? input.escalationEnabled
          : null,
        typeof input.escalationAfterMinutes === "number" ||
        input.escalationAfterMinutes === null
          ? input.escalationAfterMinutes
          : null,
      ],
    );

    return result.rows[0] ? mapPolicyRow(result.rows[0]) : null;
  },

  async createDeliveryLog(input: CreateNotificationDeliveryLogInput) {
    return this.createDeliveryLogWithExecutor({ query }, input);
  },

  async createDeliveryLogWithExecutor(
    executor: DatabaseExecutor,
    input: CreateNotificationDeliveryLogInput,
  ) {
    const result = await executor.query<NotificationDeliveryLogRow>(
      `
        INSERT INTO notification_delivery_logs (
          id,
          notification_id,
          company_id,
          event_key,
          channel,
          status,
          error_message,
          attempts,
          last_attempt_at,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
        RETURNING
          id,
          notification_id AS "notificationId",
          company_id AS "companyId",
          NULL::text AS "companyName",
          NULL::text AS "companyCode",
          event_key AS "eventKey",
          channel,
          status,
          error_message AS "errorMessage",
          attempts,
          last_attempt_at AS "lastAttemptAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          metadata
      `,
      [
        randomUUID(),
        input.notificationId ?? null,
        input.companyId ?? null,
        input.eventKey,
        input.channel,
        input.status,
        input.errorMessage ?? null,
        input.attempts ?? 0,
        input.lastAttemptAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return result.rows[0] ? mapDeliveryLogRow(result.rows[0]) : null;
  },

  async findDeliveryLogById(logId: string) {
    const result = await query<NotificationDeliveryLogRow>(
      `
        SELECT
          ndl.id,
          ndl.notification_id AS "notificationId",
          ndl.company_id AS "companyId",
          c.name AS "companyName",
          c.code AS "companyCode",
          ndl.event_key AS "eventKey",
          ndl.channel,
          ndl.status,
          ndl.error_message AS "errorMessage",
          ndl.attempts,
          ndl.last_attempt_at AS "lastAttemptAt",
          ndl.created_at AS "createdAt",
          ndl.updated_at AS "updatedAt",
          ndl.metadata
        FROM notification_delivery_logs ndl
        LEFT JOIN companies c
          ON c.id = ndl.company_id
        WHERE ndl.id = $1
      `,
      [logId],
    );

    return result.rows[0] ? mapDeliveryLogRow(result.rows[0]) : null;
  },

  async updateDeliveryLog(
    logId: string,
    input: {
      notificationId?: string | null;
      status?: NotificationDeliveryStatus;
      errorMessage?: string | null;
      attempts?: number;
      lastAttemptAt?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const result = await query<NotificationDeliveryLogRow>(
      `
        UPDATE notification_delivery_logs
        SET
          notification_id = COALESCE($2, notification_id),
          status = COALESCE($3, status),
          error_message = $4,
          attempts = COALESCE($5, attempts),
          last_attempt_at = $6,
          metadata = COALESCE($7::jsonb, metadata),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          notification_id AS "notificationId",
          company_id AS "companyId",
          NULL::text AS "companyName",
          NULL::text AS "companyCode",
          event_key AS "eventKey",
          channel,
          status,
          error_message AS "errorMessage",
          attempts,
          last_attempt_at AS "lastAttemptAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          metadata
      `,
      [
        logId,
        typeof input.notificationId === "string" ? input.notificationId : null,
        input.status ?? null,
        typeof input.errorMessage === "string" || input.errorMessage === null
          ? input.errorMessage
          : null,
        typeof input.attempts === "number" ? input.attempts : null,
        input.lastAttemptAt ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    return result.rows[0] ? mapDeliveryLogRow(result.rows[0]) : null;
  },

  async listDeliveryLogs(
    filters: NotificationDeliveryLogFilters = {},
    includeOnlyFailed = false,
  ): Promise<NotificationDeliveryLogsResponse> {
    const pagination = buildPagination(filters.page, filters.pageSize);
    const where = buildDeliveryLogFilters(filters, includeOnlyFailed);
    const countResult = await query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM notification_delivery_logs ndl
        ${where.whereClause}
      `,
      where.values,
    );
    const summaryResult = await query<StatusCountRow>(
      `
        SELECT
          ndl.status,
          COUNT(*)::text AS total
        FROM notification_delivery_logs ndl
        ${where.whereClause}
        GROUP BY ndl.status
      `,
      where.values,
    );
    const values = [...where.values, pagination.pageSize, pagination.offset];
    const rowsResult = await query<NotificationDeliveryLogRow>(
      `
        SELECT
          ndl.id,
          ndl.notification_id AS "notificationId",
          ndl.company_id AS "companyId",
          c.name AS "companyName",
          c.code AS "companyCode",
          ndl.event_key AS "eventKey",
          ndl.channel,
          ndl.status,
          ndl.error_message AS "errorMessage",
          ndl.attempts,
          ndl.last_attempt_at AS "lastAttemptAt",
          ndl.created_at AS "createdAt",
          ndl.updated_at AS "updatedAt",
          ndl.metadata
        FROM notification_delivery_logs ndl
        LEFT JOIN companies c
          ON c.id = ndl.company_id
        ${where.whereClause}
        ORDER BY ndl.created_at DESC, ndl.updated_at DESC
        LIMIT $${where.values.length + 1}
        OFFSET $${where.values.length + 2}
      `,
      values,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? "0");
    const statusCounts = summaryResult.rows.reduce(
      (summary, row) => {
        summary[row.status] = Number(row.total ?? "0");
        return summary;
      },
      {
        delivered: 0,
        failed: 0,
        pending: 0,
        "retry-queued": 0,
      } as Record<NotificationDeliveryStatus, number>,
    );

    return {
      summary: {
        totalLogs: totalItems,
        delivered: statusCounts.delivered,
        failed: statusCounts.failed,
        pending: statusCounts.pending,
        retryQueued: statusCounts["retry-queued"],
      },
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pagination.pageSize)),
        totalItems,
      },
      activeFilters: {
        status: includeOnlyFailed ? null : filters.status ?? null,
        channel: filters.channel ?? null,
        companyId: filters.companyId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      items: rowsResult.rows.map(mapDeliveryLogRow),
    };
  },

  async getHealth(): Promise<NotificationHealthResponse> {
    const [notificationCountResult, statusResult, channelResult] = await Promise.all([
      query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM notifications
        `,
      ),
      query<StatusCountRow>(
        `
          SELECT
            status,
            COUNT(*)::text AS total
          FROM notification_delivery_logs
          GROUP BY status
        `,
      ),
      query<ChannelHealthRow>(
        `
          SELECT
            channel,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'delivered')::text AS delivered,
            COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
            COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
            COUNT(*) FILTER (WHERE status = 'retry-queued')::text AS "retryQueued"
          FROM notification_delivery_logs
          GROUP BY channel
          ORDER BY channel ASC
        `,
      ),
    ]);

    const statusCounts = statusResult.rows.reduce(
      (summary, row) => {
        summary[row.status] = Number(row.total ?? "0");
        return summary;
      },
      {
        delivered: 0,
        failed: 0,
        pending: 0,
        "retry-queued": 0,
      } as Record<NotificationDeliveryStatus, number>,
    );

    return {
      totalNotifications: Number(notificationCountResult.rows[0]?.total ?? "0"),
      deliveredCount: statusCounts.delivered,
      failedCount: statusCounts.failed,
      pendingCount: statusCounts.pending,
      retryQueueCount: statusCounts["retry-queued"],
      channelSummary: channelResult.rows.map((row) => ({
        channel: row.channel,
        total: Number(row.total ?? "0"),
        delivered: Number(row.delivered ?? "0"),
        failed: Number(row.failed ?? "0"),
        pending: Number(row.pending ?? "0"),
        retryQueued: Number(row.retryQueued ?? "0"),
      })),
    };
  },
};
