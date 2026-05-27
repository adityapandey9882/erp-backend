import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../../database/index.js";
import type { DatabaseExecutor } from "../../database/index.js";
import type { AppRole } from "../roles/roles.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  CreateNotificationInput,
  NotificationBulkMutationResponse,
  NotificationRecord,
  NotificationStatus,
  NotificationType,
} from "./notifications.types.js";

type NotificationRow = {
  id: string;
  companyId: string;
  userId: string | null;
  roleTarget: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  status: NotificationStatus | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    roleTarget: row.roleTarget && isAppRole(row.roleTarget) ? row.roleTarget : null,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    entityType: row.entityType,
    entityId: row.entityId,
    status: row.status === "read" ? "read" : "unread",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function insertNotification(
  executor: DatabaseExecutor,
  input: CreateNotificationInput,
  roleTarget: AppRole | null = null,
) {
  const result = await executor.query<NotificationRow>(
    `
      INSERT INTO notifications (
        id,
        company_id,
        user_id,
        role_target,
        type,
        title,
        message,
        entity_type,
        entity_id,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unread', NOW(), NOW())
      RETURNING
        id,
        company_id AS "companyId",
        user_id AS "userId",
        role_target AS "roleTarget",
        type,
        title,
        message,
        entity_type AS "entityType",
        entity_id AS "entityId",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      randomUUID(),
      input.companyId,
      input.userId,
      roleTarget,
      input.type,
      input.title,
      input.message,
      input.entityType ?? null,
      input.entityId ?? null,
    ],
  );

  return mapNotificationRow(result.rows[0]);
}

export const notificationsRepository = {
  async createNotification(input: CreateNotificationInput, roleTarget: AppRole | null = null) {
    return insertNotification({ query }, input, roleTarget);
  },

  async createNotificationWithExecutor(
    executor: DatabaseExecutor,
    input: CreateNotificationInput,
    roleTarget: AppRole | null = null,
  ) {
    return insertNotification(executor, input, roleTarget);
  },

  async createNotifications(
    inputs: readonly CreateNotificationInput[],
  ): Promise<NotificationRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    return withTransaction(async (client) => {
      const rows: NotificationRecord[] = [];

      for (const input of inputs) {
        const result = await client.query<NotificationRow>(
          `
            INSERT INTO notifications (
              id,
              company_id,
              user_id,
              role_target,
              type,
              title,
              message,
              entity_type,
              entity_id,
              status,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unread', NOW(), NOW())
            RETURNING
              id,
              company_id AS "companyId",
              user_id AS "userId",
              role_target AS "roleTarget",
              type,
              title,
              message,
              entity_type AS "entityType",
              entity_id AS "entityId",
              status,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            randomUUID(),
            input.companyId,
            input.userId,
            input.roleTarget ?? null,
            input.type,
            input.title,
            input.message,
            input.entityType ?? null,
            input.entityId ?? null,
          ],
        );

        if (result.rows[0]) {
          rows.push(mapNotificationRow(result.rows[0]));
        }
      }

      return rows;
    });
  },

  async createNotificationsWithExecutor(
    executor: DatabaseExecutor,
    inputs: readonly CreateNotificationInput[],
  ): Promise<NotificationRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const rows: NotificationRecord[] = [];

    for (const input of inputs) {
      const result = await executor.query<NotificationRow>(
        `
          INSERT INTO notifications (
            id,
            company_id,
            user_id,
            role_target,
            type,
            title,
            message,
            entity_type,
            entity_id,
            status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unread', NOW(), NOW())
          RETURNING
            id,
            company_id AS "companyId",
            user_id AS "userId",
            role_target AS "roleTarget",
            type,
            title,
            message,
            entity_type AS "entityType",
            entity_id AS "entityId",
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          randomUUID(),
          input.companyId,
          input.userId,
          input.roleTarget ?? null,
          input.type,
          input.title,
          input.message,
          input.entityType ?? null,
          input.entityId ?? null,
        ],
      );

      if (result.rows[0]) {
        rows.push(mapNotificationRow(result.rows[0]));
      }
    }

    return rows;
  },

  async listUserNotifications(companyId: string, userId: string) {
    const result = await query<NotificationRow>(
      `
        SELECT
          id,
          company_id AS "companyId",
          user_id AS "userId",
          role_target AS "roleTarget",
          type,
          title,
          message,
          entity_type AS "entityType",
          entity_id AS "entityId",
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM notifications
        WHERE company_id = $1
          AND user_id = $2
        ORDER BY
          CASE WHEN status = 'unread' THEN 0 ELSE 1 END,
          created_at DESC,
          updated_at DESC
      `,
      [companyId, userId],
    );

    return result.rows.map(mapNotificationRow);
  },

  async getUnreadCount(companyId: string, userId: string) {
    const result = await query<{ unreadCount: string }>(
      `
        SELECT COUNT(*)::text AS "unreadCount"
        FROM notifications
        WHERE company_id = $1
          AND user_id = $2
          AND status = 'unread'
      `,
      [companyId, userId],
    );

    return Number(result.rows[0]?.unreadCount ?? "0");
  },

  async markNotificationRead(companyId: string, userId: string, notificationId: string) {
    const result = await query<NotificationRow>(
      `
        UPDATE notifications
        SET
          status = 'read',
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          company_id AS "companyId",
          user_id AS "userId",
          role_target AS "roleTarget",
          type,
          title,
          message,
          entity_type AS "entityType",
          entity_id AS "entityId",
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [companyId, userId, notificationId],
    );

    return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
  },

  async markAllNotificationsRead(companyId: string, userId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE notifications
        SET
          status = 'read',
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND status = 'unread'
        RETURNING id
      `,
      [companyId, userId],
    );

    const unreadCount = await notificationsRepository.getUnreadCount(
      companyId,
      userId,
    );
    const updatedCount = result.rowCount ?? 0;

    const response: NotificationBulkMutationResponse = {
      message:
        updatedCount > 0
          ? "All notifications marked as read."
          : "No unread notifications were found.",
      updatedCount,
      unreadCount,
    };

    return response;
  },

  async countAllNotifications() {
    const result = await query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM notifications
      `,
    );

    return Number(result.rows[0]?.total ?? "0");
  },
};
