import type { CompanyStatus } from "../companies/companies.types.js";
import type { AppRole } from "../roles/roles.types.js";

export type NotificationStatus = "unread" | "read";

export const NOTIFICATION_TYPES = [
  "maintenance.mode.toggled",
  "announcement.posted",
  "backup.completed",
  "leave.request.created",
  "leave.request.approved",
  "leave.request.rejected",
  "leave.status.changed",
  "leave.manager.reviewed",
  "onboarding.completed",
  "onboarding.reminder",
  "onboarding.upload-link",
  "onboarding.document-request",
  "offboarding.reminder",
  "offboarding.letters-generated",
  "asset.assigned",
  "company.user.created",
  "company.user.deactivated",
  "holiday.calendar.updated",
  "security.failed-login",
  "security.password.changed",
  "company.status.changed",
  "module.toggled",
  "payslip.generated",
  "approval.request.assigned",
  "approval.completed",
  "approval.rejected",
  "project.task.assigned",
  "project.task.due-date-changed",
  "project.task.blocked",
  "project.task.completed",
  "project.task.comment-added",
  "project.milestone.assigned",
  "project.milestone.due-date-changed",
  "project.milestone.at-risk",
  "project.milestone.delayed",
  "project.milestone.completed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationRecord = {
  id: string;
  companyId: string;
  userId: string | null;
  roleTarget: AppRole | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  status: NotificationStatus;
  createdAt: string;
  updatedAt: string;
};

export type NotificationWorkspaceSummary = {
  totalNotifications: number;
  unreadNotifications: number;
  readNotifications: number;
  directNotifications: number;
  roleTargetedNotifications: number;
};

export type NotificationCompanyContext = {
  id: string;
  name: string;
  code: string;
  status: CompanyStatus;
};

export type NotificationsWorkspaceResponse = {
  company: NotificationCompanyContext | null;
  summary: NotificationWorkspaceSummary;
  notifications: NotificationRecord[];
};

export type NotificationsUnreadCountResponse = {
  unreadCount: number;
};

export type NotificationMutationResponse = {
  message: string;
  notification: NotificationRecord;
  unreadCount: number;
};

export type NotificationBulkMutationResponse = {
  message: string;
  updatedCount: number;
  unreadCount: number;
};

export type CreateNotificationInput = {
  companyId: string;
  userId: string;
  roleTarget?: AppRole | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
};

export type NotificationsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 403 | 404 | 409;
      message: string;
    };
