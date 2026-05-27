import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole } from "../roles/roles.types.js";
import {
  getUserAccountStatus,
  type CompanyUserDepartmentSummary,
  type CompanyUserDesignationSummary,
  type CompanyUserManagerSummary,
  type UserAccountStatus,
} from "../users/users.types.js";
import type {
  OffboardingActorSummary,
  OffboardingChecklistSummary,
  OffboardingClearanceSummary,
  OffboardingEmployeeSummary,
  OffboardingExitType,
  OffboardingRequestRecord,
  OffboardingRequestStatus,
} from "./offboarding.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type OffboardingRequestRow = {
  id: string;
  companyId: string;
  userId: string;
  status: OffboardingRequestStatus;
  initiatedById: string | null;
  initiatedByFullName: string | null;
  initiatedByEmail: string | null;
  initiatedByRole: string | null;
  completedById: string | null;
  completedByFullName: string | null;
  completedByEmail: string | null;
  completedByRole: string | null;
  assignedHrId: string | null;
  assignedHrFullName: string | null;
  assignedHrEmail: string | null;
  assignedHrRole: string | null;
  completedAt: Date | string | null;
  fullName: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  role: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
  reportingManagerId: string | null;
  reportingManagerFullName: string | null;
  reportingManagerEmail: string | null;
  exitType: OffboardingExitType | null;
  resignationDate: Date | string | null;
  lastWorkingDate: Date | string | null;
  noticePeriodDays: number | null;
  reason: string | null;
  expectedAssetCount: number | null;
  requestedDocumentCount: number | null;
  exitInterviewScheduledAt: Date | string | null;
  finalSettlementAmount: string | number | null;
  assignedAssetCount: number;
  documentCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OffboardingAssetCountRow = {
  assignedAssetCount: number;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUserStatus(isActive: boolean): UserAccountStatus {
  return getUserAccountStatus(isActive);
}

function mapActorSummary(
  row: {
    id: string | null;
    fullName: string | null;
    email: string | null;
    role: string | null;
  },
): OffboardingActorSummary | null {
  if (!row.id || !row.fullName || !row.email || !row.role || !isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role,
  };
}

function mapManagerSummary(
  row: Pick<
    OffboardingRequestRow,
    "reportingManagerId" | "reportingManagerFullName" | "reportingManagerEmail"
  >,
): CompanyUserManagerSummary | null {
  if (!row.reportingManagerId || !row.reportingManagerFullName || !row.reportingManagerEmail) {
    return null;
  }

  return {
    id: row.reportingManagerId,
    fullName: row.reportingManagerFullName,
    email: row.reportingManagerEmail.toLowerCase(),
  };
}

function mapDepartmentSummary(
  row: Pick<OffboardingRequestRow, "departmentId" | "departmentName" | "departmentCode">,
): CompanyUserDepartmentSummary | null {
  if (!row.departmentId) {
    return null;
  }

  return {
    id: row.departmentId,
    name: row.departmentName ?? "Unknown Department",
    code: row.departmentCode ?? "",
  };
}

function mapDesignationSummary(
  row: Pick<
    OffboardingRequestRow,
    | "designationId"
    | "designationTitle"
    | "designationCode"
    | "designationDepartmentId"
    | "designationDepartmentName"
    | "designationDepartmentCode"
  >,
): CompanyUserDesignationSummary | null {
  if (!row.designationId) {
    return null;
  }

  return {
    id: row.designationId,
    title: row.designationTitle ?? "Unknown Designation",
    code: row.designationCode ?? "",
    department: row.designationDepartmentId
      ? {
          id: row.designationDepartmentId,
          name: row.designationDepartmentName ?? "Unknown Department",
          code: row.designationDepartmentCode ?? "",
        }
      : null,
  };
}

function buildPlaceholderChecklist(): OffboardingChecklistSummary {
  return {
    items: [],
    completedCount: 0,
    totalCount: 0,
    progressPercent: 0,
  };
}

function buildPlaceholderClearance(
  expectedAssetCount: number,
  pendingAssetCount: number,
  documentCount: number,
  requestedDocumentCount: number,
): OffboardingClearanceSummary {
  return {
    expectedAssetCount,
    returnedAssetCount: Math.max(expectedAssetCount - pendingAssetCount, 0),
    pendingAssetCount,
    knowledgeTransferPercent: 0,
    pendingApprovals: 0,
    revokedAccessCount: 0,
    totalAccessCount: 0,
    exitInterviewScheduledAt: null,
    exitInterviewCompleted: false,
    finalSettlementStatus: "pending",
    finalSettlementAmount: null,
    documentsReadyCount: Math.min(documentCount, requestedDocumentCount),
    documentsPendingCount: Math.max(requestedDocumentCount - documentCount, 0),
  };
}

function mapOffboardingEmployeeSummary(
  row: OffboardingRequestRow,
): OffboardingEmployeeSummary | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.userId,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    phone: row.phone,
    employeeId: row.employeeId,
    role: row.role,
    status: toUserStatus(row.isActive),
    reportingManager: mapManagerSummary(row),
    department: mapDepartmentSummary(row),
    designation: mapDesignationSummary(row),
  };
}

function mapOffboardingRequestRow(
  row: OffboardingRequestRow | undefined,
  approvalProgress: OffboardingRequestRecord["approvalProgress"] = null,
): OffboardingRequestRecord | null {
  if (!row) {
    return null;
  }

  const employee = mapOffboardingEmployeeSummary(row);

  if (!employee) {
    return null;
  }

  const expectedAssetCount = Math.max(
    row.expectedAssetCount ?? row.assignedAssetCount,
    row.assignedAssetCount,
  );
  const requestedDocumentCount = Math.max(row.requestedDocumentCount ?? 3, 1);

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    employee,
    status: row.status,
    initiatedBy: mapActorSummary({
      id: row.initiatedById,
      fullName: row.initiatedByFullName,
      email: row.initiatedByEmail,
      role: row.initiatedByRole,
    }),
    completedBy: mapActorSummary({
      id: row.completedById,
      fullName: row.completedByFullName,
      email: row.completedByEmail,
      role: row.completedByRole,
    }),
    completedAt: row.completedAt ? toIsoString(row.completedAt) : null,
    assignedHr: mapActorSummary({
      id: row.assignedHrId,
      fullName: row.assignedHrFullName,
      email: row.assignedHrEmail,
      role: row.assignedHrRole,
    }),
    department: mapDepartmentSummary(row),
    designation: mapDesignationSummary(row),
    reportingManager: mapManagerSummary(row),
    exitType: row.exitType ?? "resignation",
    resignationDate: row.resignationDate ? toIsoString(row.resignationDate) : null,
    lastWorkingDate: row.lastWorkingDate ? toIsoString(row.lastWorkingDate) : null,
    noticePeriodDays: row.noticePeriodDays,
    reason: row.reason,
    expectedAssetCount,
    requestedDocumentCount,
    exitInterviewScheduledAt: row.exitInterviewScheduledAt
      ? toIsoString(row.exitInterviewScheduledAt)
      : null,
    finalSettlementAmount:
      row.finalSettlementAmount === null
        ? null
        : Number(row.finalSettlementAmount),
    assignedAssetCount: row.assignedAssetCount,
    documentCount: row.documentCount,
    approvalProgress,
    workflowStage: row.status === "completed" ? "completed" : "clearance-pending",
    checklist: buildPlaceholderChecklist(),
    clearance: buildPlaceholderClearance(
      expectedAssetCount,
      row.assignedAssetCount,
      row.documentCount,
      requestedDocumentCount,
    ),
    progressPercent: 0,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const requestSelect = `
  SELECT
    offboarding_requests.id,
    offboarding_requests.company_id AS "companyId",
    offboarding_requests.user_id AS "userId",
    offboarding_requests.status,
    offboarding_requests.initiated_by AS "initiatedById",
    initiator.full_name AS "initiatedByFullName",
    initiator.email AS "initiatedByEmail",
    initiator.role AS "initiatedByRole",
    offboarding_requests.completed_by AS "completedById",
    completer.full_name AS "completedByFullName",
    completer.email AS "completedByEmail",
    completer.role AS "completedByRole",
    offboarding_requests.assigned_hr_user_id AS "assignedHrId",
    assigned_hr.full_name AS "assignedHrFullName",
    assigned_hr.email AS "assignedHrEmail",
    assigned_hr.role AS "assignedHrRole",
    offboarding_requests.completed_at AS "completedAt",
    offboarding_requests.exit_type AS "exitType",
    offboarding_requests.resignation_date AS "resignationDate",
    offboarding_requests.last_working_date AS "lastWorkingDate",
    offboarding_requests.notice_period_days AS "noticePeriodDays",
    offboarding_requests.reason,
    offboarding_requests.expected_asset_count AS "expectedAssetCount",
    offboarding_requests.requested_document_count AS "requestedDocumentCount",
    offboarding_requests.exit_interview_scheduled_at AS "exitInterviewScheduledAt",
    offboarding_requests.final_settlement_amount AS "finalSettlementAmount",
    offboarding_requests.created_at AS "createdAt",
    offboarding_requests.updated_at AS "updatedAt",
    target_user.full_name AS "fullName",
    target_user.email,
    target_user.phone,
    target_user.employee_id AS "employeeId",
    target_user.role,
    target_user.is_active AS "isActive",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode",
    reporting_manager.id AS "reportingManagerId",
    reporting_manager.full_name AS "reportingManagerFullName",
    reporting_manager.email AS "reportingManagerEmail",
    (
      SELECT COUNT(*)::int
      FROM company_assets
      WHERE company_assets.company_id = offboarding_requests.company_id
        AND company_assets.assigned_to_user_id = offboarding_requests.user_id
        AND company_assets.status = 'assigned'
    ) AS "assignedAssetCount",
    (
      SELECT COUNT(*)::int
      FROM documents
      WHERE documents.company_id = offboarding_requests.company_id
        AND documents.user_id = offboarding_requests.user_id
    ) AS "documentCount"
  FROM offboarding_requests
  INNER JOIN users AS target_user
    ON target_user.id = offboarding_requests.user_id
  LEFT JOIN users AS initiator
    ON initiator.id = offboarding_requests.initiated_by
  LEFT JOIN users AS completer
    ON completer.id = offboarding_requests.completed_by
  LEFT JOIN users AS assigned_hr
    ON assigned_hr.id = offboarding_requests.assigned_hr_user_id
  LEFT JOIN departments
    ON departments.id = COALESCE(offboarding_requests.department_id, target_user.department_id)
    AND departments.company_id = offboarding_requests.company_id
  LEFT JOIN designations
    ON designations.id = COALESCE(offboarding_requests.designation_id, target_user.designation_id)
    AND designations.company_id = offboarding_requests.company_id
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = offboarding_requests.company_id
  LEFT JOIN users AS reporting_manager
    ON reporting_manager.id = COALESCE(
      offboarding_requests.reporting_manager_user_id,
      target_user.reporting_manager_id
    )
`;

export const offboardingRepository = {
  async listOffboardingRequests(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<OffboardingRequestRow>(
      `
        ${requestSelect}
        WHERE offboarding_requests.company_id = $1
        ORDER BY offboarding_requests.created_at DESC, offboarding_requests.id DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapOffboardingRequestRow(row))
      .filter((row): row is OffboardingRequestRecord => row !== null);
  },

  async findOffboardingRequestById(
    companyId: string,
    requestId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<OffboardingRequestRow>(
      `
        ${requestSelect}
        WHERE offboarding_requests.company_id = $1
          AND offboarding_requests.id = $2
        LIMIT 1
      `,
      [companyId, requestId],
    );

    return mapOffboardingRequestRow(result.rows[0]);
  },

  async findActiveOffboardingRequestByUserId(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<OffboardingRequestRow>(
      `
        ${requestSelect}
        WHERE offboarding_requests.company_id = $1
          AND offboarding_requests.user_id = $2
          AND offboarding_requests.status IN ('pending', 'approved')
        ORDER BY offboarding_requests.created_at DESC, offboarding_requests.id DESC
        LIMIT 1
      `,
      [companyId, userId],
    );

    return mapOffboardingRequestRow(result.rows[0]);
  },

  async createOffboardingRequest(
    input: {
      companyId: string;
      userId: string;
      initiatedBy: string;
      assignedHrUserId: string;
      departmentId: string;
      designationId: string;
      reportingManagerUserId: string;
      exitType: OffboardingExitType;
      resignationDate: string;
      lastWorkingDate: string;
      noticePeriodDays: number;
      reason: string | null;
      expectedAssetCount: number;
      requestedDocumentCount: number;
      exitInterviewScheduledAt: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO offboarding_requests (
          id,
          company_id,
          user_id,
          status,
          initiated_by,
          assigned_hr_user_id,
          department_id,
          designation_id,
          reporting_manager_user_id,
          exit_type,
          resignation_date,
          last_working_date,
          notice_period_days,
          reason,
          expected_asset_count,
          requested_document_count,
          exit_interview_scheduled_at,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          'pending',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::date,
          $11::date,
          $12,
          $13,
          $14,
          $15,
          $16::timestamptz,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.userId,
        input.initiatedBy,
        input.assignedHrUserId,
        input.departmentId,
        input.designationId,
        input.reportingManagerUserId,
        input.exitType,
        input.resignationDate,
        input.lastWorkingDate,
        input.noticePeriodDays,
        input.reason,
        input.expectedAssetCount,
        input.requestedDocumentCount,
        input.exitInterviewScheduledAt,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateOffboardingRequestStatus(
    companyId: string,
    requestId: string,
    status: OffboardingRequestStatus,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE offboarding_requests
        SET
          status = $3,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [companyId, requestId, status],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateOffboardingRequestDetails(
    companyId: string,
    requestId: string,
    input: {
      departmentId: string;
      designationId: string;
      reportingManagerUserId: string;
      exitType: OffboardingExitType;
      resignationDate: string;
      lastWorkingDate: string;
      noticePeriodDays: number;
      reason: string | null;
      exitInterviewScheduledAt: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE offboarding_requests
        SET
          department_id = $3,
          designation_id = $4,
          reporting_manager_user_id = $5,
          exit_type = $6,
          resignation_date = $7::date,
          last_working_date = $8::date,
          notice_period_days = $9,
          reason = $10,
          exit_interview_scheduled_at = $11::timestamptz,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        companyId,
        requestId,
        input.departmentId,
        input.designationId,
        input.reportingManagerUserId,
        input.exitType,
        input.resignationDate,
        input.lastWorkingDate,
        input.noticePeriodDays,
        input.reason,
        input.exitInterviewScheduledAt,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async completeOffboardingRequest(
    companyId: string,
    requestId: string,
    completedBy: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE offboarding_requests
        SET
          status = 'completed',
          completed_by = $3,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
          AND status = 'approved'
        RETURNING id
      `,
      [companyId, requestId, completedBy],
    );

    return result.rows[0]?.id ?? null;
  },

  async countAssignedAssetsByUser(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<OffboardingAssetCountRow>(
      `
        SELECT COUNT(*)::int AS "assignedAssetCount"
        FROM company_assets
        WHERE company_id = $1
          AND assigned_to_user_id = $2
          AND status = 'assigned'
      `,
      [companyId, userId],
    );

    return result.rows[0]?.assignedAssetCount ?? 0;
  },
};
