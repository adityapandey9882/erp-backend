import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  CreateEmployeeLeaveRequest,
  HrReviewableLeaveStatus,
  LeaveRequest,
  LeaveRequestStatus,
  ManagerReviewAction,
} from "./leave.types.js";
import {
  isLeaveRequestStatus,
  isManagerLeaveReviewStatus,
} from "./leave.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type LeaveRequestRow = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: string;
  managerReviewStatus: string;
  managerReviewedAt: Date | string | null;
  managerReviewerId: string | null;
  managerReviewerFullName: string | null;
  managerReviewerEmail: string | null;
  managerReviewerRole: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
}

function calculateRequestedDays(startDate: string, endDate: string) {
  const difference = parseDateOnly(endDate) - parseDateOnly(startDate);

  return Math.max(1, Math.floor(difference / 86400000) + 1);
}

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function mapLeaveRequest(row: LeaveRequestRow | undefined): LeaveRequest | null {
  if (
    !row ||
    !isLeaveRequestStatus(row.status) ||
    !isManagerLeaveReviewStatus(row.managerReviewStatus)
  ) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    startDate: row.startDate,
    endDate: row.endDate,
    requestedDays: calculateRequestedDays(row.startDate, row.endDate),
    leaveType: row.leaveType,
    reason: row.reason,
    status: row.status,
    managerReview: {
      status: row.managerReviewStatus,
      reviewedAt: row.managerReviewedAt ? toIsoString(row.managerReviewedAt) : null,
      reviewedBy:
        row.managerReviewerId &&
        row.managerReviewerFullName &&
        row.managerReviewerEmail &&
        row.managerReviewerRole &&
        isAppRole(row.managerReviewerRole)
          ? {
              id: row.managerReviewerId,
              fullName: row.managerReviewerFullName,
              email: row.managerReviewerEmail,
              role: row.managerReviewerRole,
            }
          : null,
    },
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const leaveRequestSelect = `
  SELECT
    leave_requests.id,
    leave_requests.user_id AS "userId",
    leave_requests.start_date::text AS "startDate",
    leave_requests.end_date::text AS "endDate",
    leave_requests.leave_type AS "leaveType",
    leave_requests.reason,
    leave_requests.status,
    leave_requests.manager_review_status AS "managerReviewStatus",
    leave_requests.manager_reviewed_at AS "managerReviewedAt",
    manager_reviewer.id AS "managerReviewerId",
    manager_reviewer.full_name AS "managerReviewerFullName",
    manager_reviewer.email AS "managerReviewerEmail",
    manager_reviewer.role AS "managerReviewerRole",
    leave_requests.created_at AS "createdAt",
    leave_requests.updated_at AS "updatedAt"
  FROM leave_requests
  LEFT JOIN users AS manager_reviewer
    ON manager_reviewer.id = leave_requests.manager_reviewed_by_user_id
`;

export const leaveRepository = {
  async listCompanyLeaveRequests(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        ${leaveRequestSelect}
        WHERE leave_requests.company_id = $1
        ORDER BY leave_requests.start_date DESC, leave_requests.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row: LeaveRequestRow) => mapLeaveRequest(row))
      .filter((row): row is LeaveRequest => row !== null);
  },

  async listSelfLeaveRequests(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        ${leaveRequestSelect}
        WHERE leave_requests.company_id = $1
          AND leave_requests.user_id = $2
        ORDER BY leave_requests.start_date DESC, leave_requests.created_at DESC
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row: LeaveRequestRow) => mapLeaveRequest(row))
      .filter((row): row is LeaveRequest => row !== null);
  },

  async findCompanyLeaveRequestById(
    companyId: string,
    leaveId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        ${leaveRequestSelect}
        WHERE leave_requests.company_id = $1
          AND leave_requests.id = $2
        LIMIT 1
      `,
      [companyId, leaveId],
    );

    return mapLeaveRequest(result.rows[0]);
  },

  async findOverlappingOpenLeaveRequest(
    companyId: string,
    userId: string,
    startDate: string,
    endDate: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        ${leaveRequestSelect}
        WHERE leave_requests.company_id = $1
          AND leave_requests.user_id = $2
          AND leave_requests.status IN ('pending', 'approved')
          AND NOT (
            leave_requests.end_date < $3::date
            OR leave_requests.start_date > $4::date
          )
        ORDER BY leave_requests.start_date DESC, leave_requests.created_at DESC
        LIMIT 1
      `,
      [companyId, userId, startDate, endDate],
    );

    return mapLeaveRequest(result.rows[0]);
  },

  async createLeaveRequest(
    companyId: string,
    userId: string,
    input: CreateEmployeeLeaveRequest,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        INSERT INTO leave_requests (
          id,
          company_id,
          user_id,
          start_date,
          end_date,
          leave_type,
          reason,
          status,
          manager_review_status,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::date,
          $5::date,
          $6,
          $7,
          'pending',
          'pending',
          NOW(),
          NOW()
        )
        RETURNING
          id,
          user_id AS "userId",
          start_date::text AS "startDate",
          end_date::text AS "endDate",
          leave_type AS "leaveType",
          reason,
          status,
          manager_review_status AS "managerReviewStatus",
          manager_reviewed_at AS "managerReviewedAt",
          NULL::text AS "managerReviewerId",
          NULL::text AS "managerReviewerFullName",
          NULL::text AS "managerReviewerEmail",
          NULL::text AS "managerReviewerRole",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        companyId,
        userId,
        input.startDate,
        input.endDate,
        input.leaveType,
        input.reason,
      ],
    );

    return mapLeaveRequest(result.rows[0]);
  },

  async updateLeaveStatus(
    companyId: string,
    leaveId: string,
    status: HrReviewableLeaveStatus,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        WITH updated AS (
          UPDATE leave_requests
          SET
            status = $3,
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
          RETURNING *
        )
        SELECT
          updated.id,
          updated.user_id AS "userId",
          updated.start_date::text AS "startDate",
          updated.end_date::text AS "endDate",
          updated.leave_type AS "leaveType",
          updated.reason,
          updated.status,
          updated.manager_review_status AS "managerReviewStatus",
          updated.manager_reviewed_at AS "managerReviewedAt",
          manager_reviewer.id AS "managerReviewerId",
          manager_reviewer.full_name AS "managerReviewerFullName",
          manager_reviewer.email AS "managerReviewerEmail",
          manager_reviewer.role AS "managerReviewerRole",
          updated.created_at AS "createdAt",
          updated.updated_at AS "updatedAt"
        FROM updated
        LEFT JOIN users AS manager_reviewer
          ON manager_reviewer.id = updated.manager_reviewed_by_user_id
      `,
      [companyId, leaveId, status],
    );

    return mapLeaveRequest(result.rows[0]);
  },

  async updateManagerReview(
    companyId: string,
    leaveId: string,
    input: {
      status: ManagerReviewAction;
      reviewerUserId: string;
      requestStatus: LeaveRequestStatus;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<LeaveRequestRow>(
      `
        WITH updated AS (
          UPDATE leave_requests
          SET
            manager_review_status = $3,
            manager_reviewed_by_user_id = $4,
            manager_reviewed_at = NOW(),
            status = $5,
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
          RETURNING *
        )
        SELECT
          updated.id,
          updated.user_id AS "userId",
          updated.start_date::text AS "startDate",
          updated.end_date::text AS "endDate",
          updated.leave_type AS "leaveType",
          updated.reason,
          updated.status,
          updated.manager_review_status AS "managerReviewStatus",
          updated.manager_reviewed_at AS "managerReviewedAt",
          manager_reviewer.id AS "managerReviewerId",
          manager_reviewer.full_name AS "managerReviewerFullName",
          manager_reviewer.email AS "managerReviewerEmail",
          manager_reviewer.role AS "managerReviewerRole",
          updated.created_at AS "createdAt",
          updated.updated_at AS "updatedAt"
        FROM updated
        LEFT JOIN users AS manager_reviewer
          ON manager_reviewer.id = updated.manager_reviewed_by_user_id
      `,
      [
        companyId,
        leaveId,
        input.status,
        input.reviewerUserId,
        input.requestStatus,
      ],
    );

    return mapLeaveRequest(result.rows[0]);
  },
};
