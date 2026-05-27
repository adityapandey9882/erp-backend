import type { AppRole } from "../roles/roles.types.js";
import { isAppRole } from "../roles/roles.types.js";
import { usersRepository } from "../users/users.repository.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { withTransaction } from "../../database/index.js";
import { notificationOpsRepository } from "./notification-ops.repository.js";
import type {
  CreateNotificationDeliveryLogInput,
  NotificationDeliveryLogFilters,
  NotificationDeliveryStatus,
  NotificationHealthResponse,
  NotificationOpsServiceResult,
  NotificationPoliciesResponse,
  NotificationPolicyView,
  NotificationRetryResponse,
  NotificationRulesResponse,
  UpdateNotificationPolicyRequest,
  UpdateNotificationRuleRequest,
  NotificationDeliveryChannel,
  NotificationDeliveryLogsResponse,
} from "./notification-ops.types.js";
import { notificationsRepository } from "./notifications.repository.js";
import type { CreateNotificationInput, NotificationType } from "./notifications.types.js";

function ok<T>(data: T): NotificationOpsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): NotificationOpsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isSuperadminUser(
  user: AuthenticatedUser | undefined,
): user is AuthenticatedUser {
  return Boolean(user && user.role === "superadmin");
}

function normalizeDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeFilterValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePagination(page?: number | null, pageSize?: number | null) {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  const safePageSize =
    Number.isInteger(pageSize) && (pageSize as number) > 0
      ? Math.min(pageSize as number, 100)
      : 20;

  return {
    page: safePage,
    pageSize: safePageSize,
  };
}

function getUnavailableTransportMessage(channel: NotificationDeliveryChannel) {
  if (channel === "email") {
    return "Email delivery transport is not configured for notification operations yet.";
  }

  if (channel === "sms") {
    return "SMS delivery transport is not configured for notification operations yet.";
  }

  return "In-app delivery could not be completed.";
}

function buildHistoryEntry(
  status: NotificationDeliveryStatus,
  errorMessage: string | null,
  attempts: number,
  trigger: "initial" | "manual-retry",
) {
  return {
    attempts,
    status,
    errorMessage,
    trigger,
    attemptedAt: new Date().toISOString(),
  };
}

function buildInitialLogMetadata(
  notificationInput: Omit<CreateNotificationInput, "companyId" | "userId"> & {
    userId: string;
  },
) {
  return {
    userId: notificationInput.userId,
    roleTarget: notificationInput.roleTarget ?? null,
    title: notificationInput.title,
    message: notificationInput.message,
    entityType: notificationInput.entityType ?? null,
    entityId: notificationInput.entityId ?? null,
  };
}

function getRetryStatus(nextAttempts: number, maxRetries: number) {
  return nextAttempts < maxRetries ? "retry-queued" : "failed";
}

function appendHistory(
  metadata: Record<string, unknown>,
  entry: ReturnType<typeof buildHistoryEntry>,
) {
  const existingHistory = Array.isArray(metadata.history)
    ? metadata.history.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  return {
    ...metadata,
    history: [...existingHistory, entry],
  };
}

async function dispatchNotificationTargets(
  companyId: string,
  targets: Array<{
    userId: string;
    roleTarget: AppRole | null;
  }>,
  input: Omit<CreateNotificationInput, "companyId" | "userId">,
) {
  if (targets.length === 0) {
    return;
  }

  const [rule, policy] = await Promise.all([
    notificationOpsRepository.findRuleByEventKey(input.type),
    notificationOpsRepository.findPolicyByEventKey(input.type),
  ]);

  const channels =
    rule && rule.enabled
      ? rule.channels
      : rule && !rule.enabled
        ? []
        : (["in-app"] as NotificationDeliveryChannel[]);
  const maxRetries = Math.max(policy?.maxRetries ?? 1, 1);

  if (channels.length === 0) {
    return;
  }

  try {
    await withTransaction(async (client) => {
      for (const target of targets) {
        const baseMetadata = buildInitialLogMetadata({
          userId: target.userId,
          roleTarget: target.roleTarget,
          type: input.type,
          title: input.title,
          message: input.message,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
        });

        for (const channel of channels) {
          if (channel === "in-app") {
            try {
              const notification =
                await notificationsRepository.createNotificationWithExecutor(
                  client,
                  {
                    companyId,
                    userId: target.userId,
                    roleTarget: target.roleTarget,
                    type: input.type,
                    title: input.title,
                    message: input.message,
                    entityType: input.entityType ?? null,
                    entityId: input.entityId ?? null,
                  },
                  target.roleTarget,
                );

              await notificationOpsRepository.createDeliveryLogWithExecutor(client, {
                notificationId: notification.id,
                companyId,
                eventKey: input.type,
                channel,
                status: "delivered",
                errorMessage: null,
                attempts: 1,
                lastAttemptAt: new Date().toISOString(),
                metadata: appendHistory(baseMetadata, buildHistoryEntry("delivered", null, 1, "initial")),
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "In-app delivery failed.";
              const status = getRetryStatus(1, maxRetries);

              await notificationOpsRepository.createDeliveryLogWithExecutor(client, {
                companyId,
                eventKey: input.type,
                channel,
                status,
                errorMessage,
                attempts: 1,
                lastAttemptAt: new Date().toISOString(),
                metadata: appendHistory(
                  baseMetadata,
                  buildHistoryEntry(status, errorMessage, 1, "initial"),
                ),
              });
            }

            continue;
          }

          const errorMessage = getUnavailableTransportMessage(channel);
          const status = getRetryStatus(1, maxRetries);

          await notificationOpsRepository.createDeliveryLogWithExecutor(client, {
            companyId,
            eventKey: input.type,
            channel,
            status,
            errorMessage,
            attempts: 1,
            lastAttemptAt: new Date().toISOString(),
            metadata: appendHistory(
              baseMetadata,
              buildHistoryEntry(status, errorMessage, 1, "initial"),
            ),
          });
        }
      }
    });
  } catch (error) {
    console.warn("Failed to dispatch notification operations delivery.", {
      companyId,
      type: input.type,
      targetCount: targets.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getRecipientsForRole(companyId: string, roleTarget: AppRole) {
  const profiles = await usersRepository.listCompanyUserProfiles(companyId);

  return profiles
    .filter((profile) => profile.role === roleTarget)
    .map((profile) => ({
      userId: profile.id,
      roleTarget,
    }));
}

function normalizeFilters(filters: NotificationDeliveryLogFilters = {}) {
  const normalized = {
    status: filters.status ?? null,
    channel: filters.channel ?? null,
    companyId: normalizeFilterValue(filters.companyId),
    dateFrom: normalizeDateOnly(filters.dateFrom),
    dateTo: normalizeDateOnly(filters.dateTo),
    ...normalizePagination(filters.page, filters.pageSize),
  };

  return normalized;
}

function buildChangedFields<T extends object>(previous: T, next: T) {
  const changedFields: Record<string, { previous: unknown; next: unknown }> = {};

  for (const key of Object.keys(next) as Array<keyof T>) {
    const previousValue = previous[key];
    const nextValue = next[key];

    if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      changedFields[String(key)] = {
        previous: previousValue ?? null,
        next: nextValue ?? null,
      };
    }
  }

  return changedFields;
}

export const notificationOpsService = {
  async listRules(
    user: AuthenticatedUser | undefined,
  ): Promise<NotificationOpsServiceResult<NotificationRulesResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    return ok({
      items: await notificationOpsRepository.listRules(),
    });
  },

  async updateRule(
    user: AuthenticatedUser | undefined,
    ruleId: string,
    input: UpdateNotificationRuleRequest,
  ): Promise<NotificationOpsServiceResult<{ message: string; rule: Awaited<ReturnType<typeof notificationOpsRepository.findRuleById>> extends infer T ? Exclude<T, null> : never }>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    const rule = await notificationOpsRepository.findRuleById(ruleId);

    if (!rule) {
      return fail(404, "Notification rule not found.");
    }

    const updatedRule = await notificationOpsRepository.updateRule(ruleId, input);

    if (!updatedRule) {
      return fail(404, "Notification rule not found.");
    }

    const changedFields = buildChangedFields(rule, updatedRule);

    if (Object.keys(changedFields).length > 0) {
      void auditService.recordAction(user, {
        companyId: null,
        action: "notification_rule_updated",
        entityType: "notification_rule",
        entityId: updatedRule.id,
        metadata: {
          ruleId: updatedRule.id,
          eventKey: updatedRule.eventKey,
          changedFields,
        },
      });
    }

    return ok({
      message:
        Object.keys(changedFields).length > 0
          ? "Notification rule updated successfully."
          : "Notification rule is already up to date.",
      rule: updatedRule,
    });
  },

  async listPolicies(
    user: AuthenticatedUser | undefined,
  ): Promise<NotificationOpsServiceResult<NotificationPoliciesResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    return ok({
      items: await notificationOpsRepository.listPolicies(),
    });
  },

  async updatePolicy(
    user: AuthenticatedUser | undefined,
    policyId: string,
    input: UpdateNotificationPolicyRequest,
  ): Promise<NotificationOpsServiceResult<{ message: string; policy: NotificationPolicyView }>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    const policy = await notificationOpsRepository.findPolicyById(policyId);

    if (!policy) {
      return fail(404, "Notification policy not found.");
    }

    const updatedPolicy = await notificationOpsRepository.updatePolicy(policyId, input);

    if (!updatedPolicy) {
      return fail(404, "Notification policy not found.");
    }

    const changedFields = buildChangedFields(policy, updatedPolicy);

    if (Object.keys(changedFields).length > 0) {
      void auditService.recordAction(user, {
        companyId: null,
        action: "notification_policy_updated",
        entityType: "notification_policy",
        entityId: updatedPolicy.id,
        metadata: {
          policyId: updatedPolicy.id,
          eventKey: updatedPolicy.eventKey,
          changedFields,
        },
      });
    }

    return ok({
      message:
        Object.keys(changedFields).length > 0
          ? "Notification policy updated successfully."
          : "Notification policy is already up to date.",
      policy: updatedPolicy,
    });
  },

  async listDeliveryLogs(
    user: AuthenticatedUser | undefined,
    filters: NotificationDeliveryLogFilters = {},
  ): Promise<NotificationOpsServiceResult<NotificationDeliveryLogsResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    const normalizedFilters = normalizeFilters(filters);

    if (
      normalizedFilters.dateFrom &&
      normalizedFilters.dateTo &&
      normalizedFilters.dateFrom > normalizedFilters.dateTo
    ) {
      return fail(400, "The delivery log date range is invalid.");
    }

    return ok(await notificationOpsRepository.listDeliveryLogs(normalizedFilters, false));
  },

  async listFailedLogs(
    user: AuthenticatedUser | undefined,
    filters: NotificationDeliveryLogFilters = {},
  ): Promise<NotificationOpsServiceResult<NotificationDeliveryLogsResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    const normalizedFilters = normalizeFilters(filters);

    if (
      normalizedFilters.dateFrom &&
      normalizedFilters.dateTo &&
      normalizedFilters.dateFrom > normalizedFilters.dateTo
    ) {
      return fail(400, "The failed delivery log date range is invalid.");
    }

    return ok(await notificationOpsRepository.listDeliveryLogs(normalizedFilters, true));
  },

  async retryDelivery(
    user: AuthenticatedUser | undefined,
    logId: string,
  ): Promise<NotificationOpsServiceResult<NotificationRetryResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    const log = await notificationOpsRepository.findDeliveryLogById(logId);

    if (!log) {
      return fail(404, "Notification delivery log not found.");
    }

    if (log.status !== "failed" && log.status !== "retry-queued") {
      return fail(409, "Only failed or queued notification deliveries can be retried.");
    }

    const policy = await notificationOpsRepository.findPolicyByEventKey(log.eventKey);
    const maxRetries = Math.max(policy?.maxRetries ?? 1, 1);
    const nextAttempts = log.attempts + 1;
    const baseMetadata =
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? log.metadata
        : {};
    let nextStatus: NotificationDeliveryStatus = "failed";
    let errorMessage: string | null = null;
    let notificationId = log.notificationId;

    if (log.channel === "in-app") {
      const userId = typeof baseMetadata.userId === "string" ? baseMetadata.userId : null;
      const roleTarget =
        typeof baseMetadata.roleTarget === "string" && isAppRole(baseMetadata.roleTarget)
          ? baseMetadata.roleTarget
          : null;
      const title = typeof baseMetadata.title === "string" ? baseMetadata.title : "";
      const message =
        typeof baseMetadata.message === "string" ? baseMetadata.message : "";
      const entityType =
        typeof baseMetadata.entityType === "string" ? baseMetadata.entityType : null;
      const entityId =
        typeof baseMetadata.entityId === "string" ? baseMetadata.entityId : null;

      if (!log.company?.id || !userId || !title || !message) {
        return fail(
          409,
          "This delivery log does not have enough context to be retried safely.",
        );
      }

      try {
        const notification = await notificationsRepository.createNotification(
          {
            companyId: log.company.id,
            userId,
            roleTarget,
            type: log.eventKey,
            title,
            message,
            entityType,
            entityId,
          },
          roleTarget,
        );

        notificationId = notification.id;
        nextStatus = "delivered";
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : "In-app delivery failed.";
        nextStatus = getRetryStatus(nextAttempts, maxRetries);
      }
    } else {
      errorMessage = getUnavailableTransportMessage(log.channel);
      nextStatus = getRetryStatus(nextAttempts, maxRetries);
    }

    const updatedLog = await notificationOpsRepository.updateDeliveryLog(log.id, {
      notificationId,
      status: nextStatus,
      errorMessage,
      attempts: nextAttempts,
      lastAttemptAt: new Date().toISOString(),
      metadata: appendHistory(
        baseMetadata,
        buildHistoryEntry(nextStatus, errorMessage, nextAttempts, "manual-retry"),
      ),
    });

    if (!updatedLog) {
      return fail(404, "Notification delivery log not found.");
    }

    void auditService.recordAction(user, {
      companyId: updatedLog.company?.id ?? null,
      action: "notification_retry_triggered",
      entityType: "notification_delivery_log",
      entityId: updatedLog.id,
      metadata: {
        logId: updatedLog.id,
        eventKey: updatedLog.eventKey,
        channel: updatedLog.channel,
        status: updatedLog.status,
        attempts: updatedLog.attempts,
      },
    });

    return ok({
      message:
        updatedLog.status === "delivered"
          ? "Notification delivery retried successfully."
          : updatedLog.status === "retry-queued"
            ? "Notification retry recorded and kept in the retry queue."
            : "Notification retry failed.",
      log: updatedLog,
    });
  },

  async getHealth(
    user: AuthenticatedUser | undefined,
  ): Promise<NotificationOpsServiceResult<NotificationHealthResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access notification operations.");
    }

    return ok(await notificationOpsRepository.getHealth());
  },

  async notifyUser(
    companyId: string,
    userId: string,
    input: Omit<CreateNotificationInput, "companyId" | "userId">,
  ) {
    await dispatchNotificationTargets(
      companyId,
      [
        {
          userId,
          roleTarget: input.roleTarget ?? null,
        },
      ],
      input,
    );
  },

  async notifyUsers(
    companyId: string,
    userIds: readonly string[],
    input: Omit<CreateNotificationInput, "companyId" | "userId" | "roleTarget">,
  ) {
    await dispatchNotificationTargets(
      companyId,
      userIds.map((userId) => ({
        userId,
        roleTarget: null,
      })),
      input,
    );
  },

  async notifyRole(
    companyId: string,
    roleTarget: AppRole,
    input: Omit<CreateNotificationInput, "companyId" | "userId" | "roleTarget">,
  ) {
    const recipients = await getRecipientsForRole(companyId, roleTarget);
    await dispatchNotificationTargets(companyId, recipients, {
      ...input,
      roleTarget,
    });
  },
};
