import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { notificationsRepository } from "./notifications.repository.js";
import { notificationOpsService } from "./notification-ops.service.js";
import type {
  CreateNotificationInput,
  NotificationBulkMutationResponse,
  NotificationMutationResponse,
  NotificationRecord,
  NotificationsServiceResult,
  NotificationsWorkspaceResponse,
  NotificationsUnreadCountResponse,
} from "./notifications.types.js";

function ok<T>(data: T): NotificationsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): NotificationsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function buildEmptyWorkspace(): NotificationsWorkspaceResponse {
  return {
    company: null,
    summary: {
      totalNotifications: 0,
      unreadNotifications: 0,
      readNotifications: 0,
      directNotifications: 0,
      roleTargetedNotifications: 0,
    },
    notifications: [],
  };
}

function buildWorkspaceResponse(
  company: NonNullable<Awaited<ReturnType<typeof companiesService.getCompanyView>>>,
  notifications: readonly NotificationRecord[],
): NotificationsWorkspaceResponse {
  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: {
      totalNotifications: notifications.length,
      unreadNotifications: notifications.filter(
        (notification) => notification.status === "unread",
      ).length,
      readNotifications: notifications.filter(
        (notification) => notification.status === "read",
      ).length,
      directNotifications: notifications.filter(
        (notification) => notification.roleTarget === null,
      ).length,
      roleTargetedNotifications: notifications.filter(
        (notification) => notification.roleTarget !== null,
      ).length,
    },
    notifications: [...notifications],
  };
}

export const notificationsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<NotificationsServiceResult<NotificationsWorkspaceResponse>> {
    if (!user.companyId) {
      return ok(buildEmptyWorkspace());
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const notifications = await notificationsRepository.listUserNotifications(
      user.companyId,
      user.id,
    );

    return ok(buildWorkspaceResponse(company, notifications));
  },

  async getUnreadCount(
    user: AuthenticatedUser,
  ): Promise<NotificationsServiceResult<NotificationsUnreadCountResponse>> {
    if (!user.companyId) {
      return ok({ unreadCount: 0 });
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const unreadCount = await notificationsRepository.getUnreadCount(
      user.companyId,
      user.id,
    );

    return ok({ unreadCount });
  },

  async markNotificationRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<NotificationsServiceResult<NotificationMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const notification = await notificationsRepository.markNotificationRead(
      user.companyId,
      user.id,
      notificationId,
    );

    if (!notification) {
      return fail(404, "Notification not found.");
    }

    const unreadCount = await notificationsRepository.getUnreadCount(
      user.companyId,
      user.id,
    );

    return ok({
      message: "Notification marked as read.",
      notification,
      unreadCount,
    });
  },

  async markAllNotificationsRead(
    user: AuthenticatedUser,
  ): Promise<NotificationsServiceResult<NotificationBulkMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const result = await notificationsRepository.markAllNotificationsRead(
      user.companyId,
      user.id,
    );

    return ok(result);
  },

  async notifyUser(
    companyId: string,
    userId: string,
    input: Omit<CreateNotificationInput, "companyId" | "userId">,
  ) {
    await notificationOpsService.notifyUser(companyId, userId, input);
  },

  async notifyRole(
    companyId: string,
    roleTarget: NonNullable<CreateNotificationInput["roleTarget"]>,
    input: Omit<CreateNotificationInput, "companyId" | "userId" | "roleTarget">,
  ) {
    await notificationOpsService.notifyRole(companyId, roleTarget, input);
  },

  async notifyUsers(
    companyId: string,
    userIds: readonly string[],
    input: Omit<CreateNotificationInput, "companyId" | "userId" | "roleTarget">,
  ) {
    await notificationOpsService.notifyUsers(companyId, userIds, input);
  },
};
