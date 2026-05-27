import type { NotificationType } from "./notifications.types.js";

export const NOTIFICATION_DELIVERY_CHANNELS = [
  "in-app",
  "email",
  "sms",
] as const;

export type NotificationDeliveryChannel =
  (typeof NOTIFICATION_DELIVERY_CHANNELS)[number];

export const NOTIFICATION_RULE_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type NotificationRuleSeverity =
  (typeof NOTIFICATION_RULE_SEVERITIES)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  "delivered",
  "failed",
  "pending",
  "retry-queued",
] as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export type NotificationRuleView = {
  id: string;
  module: string;
  eventKey: NotificationType;
  label: string;
  description: string;
  enabled: boolean;
  channels: NotificationDeliveryChannel[];
  severity: NotificationRuleSeverity;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRulesResponse = {
  items: NotificationRuleView[];
};

export type UpdateNotificationRuleRequest = {
  enabled?: boolean;
  channels?: NotificationDeliveryChannel[];
  severity?: NotificationRuleSeverity;
};

export type NotificationPolicyView = {
  id: string;
  eventKey: NotificationType;
  label: string;
  module: string;
  reminderEnabled: boolean;
  reminderIntervalMinutes: number | null;
  maxRetries: number;
  escalationEnabled: boolean;
  escalationAfterMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPoliciesResponse = {
  items: NotificationPolicyView[];
};

export type UpdateNotificationPolicyRequest = {
  reminderEnabled?: boolean;
  reminderIntervalMinutes?: number | null;
  maxRetries?: number;
  escalationEnabled?: boolean;
  escalationAfterMinutes?: number | null;
};

export type NotificationDeliveryLogView = {
  id: string;
  notificationId: string | null;
  company: {
    id: string;
    name: string;
    code: string;
  } | null;
  eventKey: NotificationType;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type NotificationDeliveryLogFilters = {
  status?: NotificationDeliveryStatus | null;
  channel?: NotificationDeliveryChannel | null;
  companyId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
};

export type NotificationDeliveryLogsResponse = {
  summary: {
    totalLogs: number;
    delivered: number;
    failed: number;
    pending: number;
    retryQueued: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  activeFilters: {
    status: NotificationDeliveryStatus | null;
    channel: NotificationDeliveryChannel | null;
    companyId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  items: NotificationDeliveryLogView[];
};

export type NotificationRetryResponse = {
  message: string;
  log: NotificationDeliveryLogView;
};

export type NotificationHealthResponse = {
  totalNotifications: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  retryQueueCount: number;
  channelSummary: Array<{
    channel: NotificationDeliveryChannel;
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    retryQueued: number;
  }>;
};

export type NotificationOpsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      message: string;
    };

export type CreateNotificationDeliveryLogInput = {
  notificationId?: string | null;
  companyId?: string | null;
  eventKey: NotificationType;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  errorMessage?: string | null;
  attempts?: number;
  lastAttemptAt?: string | null;
  metadata?: Record<string, unknown>;
};
