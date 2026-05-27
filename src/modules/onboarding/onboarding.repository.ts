import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import {
  isEmployeeProfileEmploymentType,
} from "../employee-self/employee-self.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  OnboardingActorSummary,
  OnboardingEmployeeSummary,
  OnboardingRequestRecord,
  OnboardingRequestStatus,
} from "./onboarding.types.js";
import type {
  CompanyUserDepartmentSummary,
  CompanyUserDesignationSummary,
  UserAccountStatus,
} from "../users/users.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type OnboardingEmployeeRow = {
  userId: string;
  fullName: string;
  email: string;
  personalEmail: string | null;
  phone: string | null;
  employeeId: string | null;
  role: string;
  isActive: boolean;
  employmentType: string | null;
  reportingManagerId: string | null;
  reportingManagerFullName: string | null;
  reportingManagerEmail: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
};

type OnboardingRequestRow = OnboardingEmployeeRow & {
  id: string;
  companyId: string;
  status: OnboardingRequestStatus;
  documentCount: number;
  joiningDate: Date | string | null;
  assignedHrId: string | null;
  assignedHrFullName: string | null;
  assignedHrEmail: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnlyString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function toUserStatus(isActive: boolean): UserAccountStatus {
  return isActive ? "active" : "inactive";
}

function mapActorSummary(input: {
  id: string | null;
  fullName: string | null;
  email: string | null;
}): OnboardingActorSummary | null {
  if (!input.id || !input.fullName || !input.email) {
    return null;
  }

  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email.toLowerCase(),
  };
}

function mapOnboardingEmployeeSummary(
  row: OnboardingEmployeeRow,
): OnboardingEmployeeSummary | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  const department: CompanyUserDepartmentSummary | null = row.departmentId
    ? {
        id: row.departmentId,
        name: row.departmentName ?? "Unknown Department",
        code: row.departmentCode ?? "",
      }
    : null;

  const designation: CompanyUserDesignationSummary | null = row.designationId
    ? {
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
      }
    : null;

  return {
    id: row.userId,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    personalEmail: row.personalEmail?.toLowerCase() ?? null,
    phone: row.phone,
    employeeId: row.employeeId,
    role: row.role,
    status: toUserStatus(row.isActive),
    employmentType:
      row.employmentType && isEmployeeProfileEmploymentType(row.employmentType)
        ? row.employmentType
        : null,
    reportingManager: mapActorSummary({
      id: row.reportingManagerId,
      fullName: row.reportingManagerFullName,
      email: row.reportingManagerEmail,
    }),
    department,
    designation,
  };
}

function mapOnboardingRequestRow(row: OnboardingRequestRow | undefined): OnboardingRequestRecord | null {
  if (!row) {
    return null;
  }

  const employee = mapOnboardingEmployeeSummary(row);

  if (!employee) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    employee,
    status: row.status,
    documentCount: row.documentCount,
    approvalProgress: null,
    joiningDate: toDateOnlyString(row.joiningDate),
    assignedHr: mapActorSummary({
      id: row.assignedHrId,
      fullName: row.assignedHrFullName,
      email: row.assignedHrEmail,
    }),
    checklist: {
      items: [],
      completedCount: 0,
      totalCount: 0,
      progressPercent: 0,
    },
    documentOverview: {
      required: 0,
      uploaded: row.documentCount,
      verified: 0,
      rejected: 0,
      pending: 0,
    },
    nextActions: [],
    verificationStatus: "verification-pending",
    assignedAssetsCount: 0,
    hasBankDetails: false,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const onboardingEmployeeSelect = `
  SELECT
    target_user.id AS "userId",
    target_user.full_name AS "fullName",
    target_user.email,
    target_user.personal_email AS "personalEmail",
    target_user.phone,
    target_user.employee_id AS "employeeId",
    target_user.role,
    target_user.is_active AS "isActive",
    target_user.employment_type AS "employmentType",
    reporting_manager.id AS "reportingManagerId",
    reporting_manager.full_name AS "reportingManagerFullName",
    reporting_manager.email AS "reportingManagerEmail",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode"
  FROM users AS target_user
  LEFT JOIN users AS reporting_manager
    ON reporting_manager.id = target_user.reporting_manager_id
    AND reporting_manager.company_id = $1
  LEFT JOIN departments
    ON departments.id = target_user.department_id
    AND departments.company_id = $1
  LEFT JOIN designations
    ON designations.id = target_user.designation_id
    AND designations.company_id = $1
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = $1
`;

const requestSelect = `
  SELECT
    onboarding_requests.id,
    onboarding_requests.company_id AS "companyId",
    onboarding_requests.status,
    onboarding_requests.joining_date AS "joiningDate",
    onboarding_requests.assigned_hr_user_id AS "assignedHrId",
    onboarding_requests.created_at AS "createdAt",
    onboarding_requests.updated_at AS "updatedAt",
    assigned_hr.full_name AS "assignedHrFullName",
    assigned_hr.email AS "assignedHrEmail",
    (
      SELECT COUNT(*)::int
      FROM documents
      WHERE documents.company_id = onboarding_requests.company_id
        AND documents.user_id = onboarding_requests.user_id
    ) AS "documentCount",
    employee_records.*
  FROM onboarding_requests
  INNER JOIN (
    ${onboardingEmployeeSelect}
  ) AS employee_records
    ON employee_records."userId" = onboarding_requests.user_id
  LEFT JOIN users AS assigned_hr
    ON assigned_hr.id = onboarding_requests.assigned_hr_user_id
`;

export const onboardingRepository = {
  async listOnboardingCandidates(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<OnboardingEmployeeRow>(
      `
        ${onboardingEmployeeSelect}
        WHERE target_user.company_id = $1
          AND target_user.role = 'employee'
        ORDER BY target_user.full_name ASC, target_user.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapOnboardingEmployeeSummary(row))
      .filter((row): row is OnboardingEmployeeSummary => row !== null);
  },

  async listOnboardingRequests(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<OnboardingRequestRow>(
      `
        ${requestSelect}
        WHERE onboarding_requests.company_id = $1
        ORDER BY onboarding_requests.created_at DESC, onboarding_requests.id DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapOnboardingRequestRow(row))
      .filter((row): row is OnboardingRequestRecord => row !== null);
  },

  async findOnboardingRequestById(
    companyId: string,
    requestId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<OnboardingRequestRow>(
      `
        ${requestSelect}
        WHERE onboarding_requests.company_id = $1
          AND onboarding_requests.id = $2
        LIMIT 1
      `,
      [companyId, requestId],
    );

    return mapOnboardingRequestRow(result.rows[0]);
  },

  async findActiveOnboardingRequestByUserId(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<OnboardingRequestRow>(
      `
        ${requestSelect}
        WHERE onboarding_requests.company_id = $1
          AND onboarding_requests.user_id = $2
          AND onboarding_requests.status IN ('pending', 'approved')
        ORDER BY onboarding_requests.created_at DESC, onboarding_requests.id DESC
        LIMIT 1
      `,
      [companyId, userId],
    );

    return mapOnboardingRequestRow(result.rows[0]);
  },

  async createOnboardingRequest(
    input: {
      companyId: string;
      userId: string;
      joiningDate: string;
      assignedHrUserId: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO onboarding_requests (
          id,
          company_id,
          user_id,
          status,
          joining_date,
          assigned_hr_user_id,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, 'pending', $4::date, $5, NOW(), NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.userId,
        input.joiningDate,
        input.assignedHrUserId,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateOnboardingRequestStatus(
    companyId: string,
    requestId: string,
    status: OnboardingRequestStatus,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE onboarding_requests
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

  async updateOnboardingRequestDetails(
    companyId: string,
    requestId: string,
    input: {
      joiningDate: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE onboarding_requests
        SET
          joining_date = $3::date,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [companyId, requestId, input.joiningDate],
    );

    return result.rows[0]?.id ?? null;
  },
};
