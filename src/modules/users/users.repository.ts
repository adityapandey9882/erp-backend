import { randomUUID } from "node:crypto";
import { query, withTransaction, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole, ROLE_DEFINITIONS, type AppRole } from "../roles/roles.types.js";
import type {
  AdminDirectoryUser,
  CompanyUserDepartmentSummary,
  CompanyScopedUser,
  CompanyUsersWorkspaceFilters,
  GlobalUserAccountStatus,
  GlobalUserCompanyMapping,
  GlobalUserProfile,
  GlobalUsersWorkspaceFilters,
  GlobalUserView,
  CompanyUserProfile,
  CompanyUserRoleSummary,
  CreateAdminUserRecordInput,
  CreateCompanyUserRecordInput,
  UpdateGlobalUserRequest,
  UpdateCompanyUserRequest,
} from "./users.types.js";
import {
  getGlobalUserAccountStatus,
  getUserAccountStatus,
  isUserAccountActive,
} from "./users.types.js";

type AdminDirectoryRow = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: Date | string;
};

type CompanyUserRow = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  role: string;
  isActive: boolean;
  isCompanyAdminOwner: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  workLocation?: string | null;
  employmentType?: string | null;
  profilePhotoUrl?: string | null;
  reportingManagerId?: string | null;
  reportingManagerFullName?: string | null;
  reportingManagerEmail?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  designationId?: string | null;
  designationTitle?: string | null;
  designationCode?: string | null;
  designationDepartmentId?: string | null;
  designationDepartmentName?: string | null;
  designationDepartmentCode?: string | null;
  todayAttendanceStatus?: string | null;
  todayAttendanceLabel?: string | null;
  todayCheckInAt?: Date | string | null;
  todayCheckOutAt?: Date | string | null;
  monthlyPresent?: number | string | null;
  monthlyLate?: number | string | null;
  monthlyAbsent?: number | string | null;
  monthlyOnLeave?: number | string | null;
  documentsCount?: number | string | null;
};

type CompanyUserProfileRow = CompanyUserRow & {
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

type CompanyUserSummaryRow = {
  role: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
};

type CompanyUsersSummaryTotalsRow = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  onLeaveToday: number;
  newJoinersThisMonth: number;
  employeeGrowthThisMonth: number;
  newJoinersPreviousMonth: number;
};

type CompanyOfficeOptionRow = {
  name: string | null;
};

type CompanyHolidayNotificationTargetRow = {
  id: string;
  workLocation: string | null;
};

type GlobalUserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  suspendedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt: Date | string | null;
  companyMappings: unknown;
};

type GlobalUserProfileRow = GlobalUserRow & {
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
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

type GlobalUserSummaryTotalsRow = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  totalCompanies: number;
};

type GlobalUserCompanyOptionRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  onboardingStatus: string;
  archivedAt: Date | string | null;
};

const COMPANY_USER_SCOPE_SQL = `
  (
    (users.role = 'admin' AND company_admin_owner.admin_user_id IS NOT NULL)
    OR (users.role <> 'admin' AND users.company_id = $1)
  )
`;

const GLOBAL_USER_COMPANY_LINKS_SQL = `
  SELECT
    users.id AS user_id,
    companies.id,
    companies.name,
    companies.code,
    companies.status,
    companies.onboarding_status AS "onboardingStatus",
    companies.archived_at AS "archivedAt",
    TRUE AS "isPrimary"
  FROM users
  INNER JOIN companies
    ON companies.id = users.company_id
  WHERE users.role <> 'admin'
    AND users.role <> 'superadmin'

  UNION

  SELECT
    company_admins.admin_user_id AS user_id,
    companies.id,
    companies.name,
    companies.code,
    companies.status,
    companies.onboarding_status AS "onboardingStatus",
    companies.archived_at AS "archivedAt",
    CASE
      WHEN users.company_id = companies.id THEN TRUE
      ELSE FALSE
    END AS "isPrimary"
  FROM company_admins
  INNER JOIN companies
    ON companies.id = company_admins.company_id
  INNER JOIN users
    ON users.id = company_admins.admin_user_id
  WHERE users.role = 'admin'
`;

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapAdminDirectoryUser(row: AdminDirectoryRow | undefined): AdminDirectoryUser | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    status: getUserAccountStatus(row.isActive),
    createdAt: toIsoString(row.createdAt),
  };
}

function mapCompanyUser(row: CompanyUserRow | undefined): CompanyScopedUser | null {
  if (!row || !isAppRole(row.role)) {
    return null;
  }

  const monthlyPresent = toNumber(row.monthlyPresent);
  const monthlyLate = toNumber(row.monthlyLate);
  const monthlyAbsent = toNumber(row.monthlyAbsent);
  const monthlyOnLeave = toNumber(row.monthlyOnLeave);
  const attendanceTotal =
    monthlyPresent + monthlyLate + monthlyAbsent + monthlyOnLeave;
  const attendancePercent =
    attendanceTotal > 0
      ? Math.round(((monthlyPresent + monthlyLate) / attendanceTotal) * 10000) / 100
      : 0;

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    phone: row.phone ?? null,
    employeeId: row.employeeId ?? null,
    role: row.role,
    status: getUserAccountStatus(row.isActive),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    workLocation: row.workLocation ?? null,
    employmentType: row.employmentType ?? null,
    profilePhotoUrl: row.profilePhotoUrl ?? null,
    reportingManager:
      row.reportingManagerId && row.reportingManagerFullName && row.reportingManagerEmail
        ? {
            id: row.reportingManagerId,
            fullName: row.reportingManagerFullName,
            email: row.reportingManagerEmail.toLowerCase(),
          }
        : null,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }
      : null,
    designation: row.designationId
      ? {
          id: row.designationId,
          title: row.designationTitle ?? "Unknown Designation",
          code: row.designationCode ?? "",
          department: row.designationDepartmentId
            ? {
                id: row.designationDepartmentId,
                name:
                  row.designationDepartmentName ?? "Unknown Department",
                code: row.designationDepartmentCode ?? "",
              }
            : null,
        }
      : null,
    todayAttendance: {
      status:
        row.todayAttendanceStatus === "present" ||
        row.todayAttendanceStatus === "late" ||
        row.todayAttendanceStatus === "absent" ||
        row.todayAttendanceStatus === "on-leave" ||
        row.todayAttendanceStatus === "not-checked-in"
          ? row.todayAttendanceStatus
          : "not-checked-in",
      label: row.todayAttendanceLabel ?? "Not Checked-in",
      checkInAt: row.todayCheckInAt ? toIsoString(row.todayCheckInAt) : null,
      checkOutAt: row.todayCheckOutAt ? toIsoString(row.todayCheckOutAt) : null,
    },
    monthlyAttendance: {
      present: monthlyPresent,
      late: monthlyLate,
      absent: monthlyAbsent,
      onLeave: monthlyOnLeave,
      attendancePercent,
    },
    documentsCount: toNumber(row.documentsCount),
    recentActivity: [
      {
        id: `${row.id}:updated`,
        label: "Account profile updated",
        occurredAt: toIsoString(row.updatedAt),
      },
      {
        id: `${row.id}:created`,
        label: "Employee account created",
        occurredAt: toIsoString(row.createdAt),
      },
    ],
    isCompanyAdminOwner: row.isCompanyAdminOwner,
  };
}

function mapCompanyUserProfile(
  row: CompanyUserProfileRow | undefined,
): CompanyUserProfile | null {
  const baseUser = mapCompanyUser(row);

  if (!baseUser || !row) {
    return null;
  }

  return {
    ...baseUser,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }
      : null,
    designation: row.designationId
      ? {
          id: row.designationId,
          title: row.designationTitle ?? "Unknown Designation",
          code: row.designationCode ?? "",
          department: row.designationDepartmentId
            ? {
                id: row.designationDepartmentId,
                name:
                  row.designationDepartmentName ?? "Unknown Department",
                code: row.designationDepartmentCode ?? "",
              }
            : null,
        }
      : null,
  };
}

function mapCompanyUserRoleSummary(
  row: CompanyUserSummaryRow,
): CompanyUserRoleSummary | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  const role = row.role as AppRole;

  return {
    role,
    label: ROLE_DEFINITIONS[role].label,
    totalUsers: row.totalUsers,
    activeUsers: row.activeUsers,
    inactiveUsers: row.inactiveUsers,
  };
}

function mapGlobalUserCompanyMappingRecord(
  input: Record<string, unknown>,
): GlobalUserCompanyMapping | null {
  const id = typeof input.id === "string" ? input.id : "";
  const name = typeof input.name === "string" ? input.name : "";
  const code = typeof input.code === "string" ? input.code : "";
  const status = typeof input.status === "string" ? input.status : "";
  const onboardingStatus =
    typeof input.onboardingStatus === "string" ? input.onboardingStatus : "";

  if (!id || !name || !code || !status || !onboardingStatus) {
    return null;
  }

  return {
    id,
    name,
    code,
    status: status as GlobalUserCompanyMapping["status"],
    onboardingStatus:
      onboardingStatus as GlobalUserCompanyMapping["onboardingStatus"],
    archivedAt:
      input.archivedAt instanceof Date
        ? input.archivedAt.toISOString()
        : typeof input.archivedAt === "string"
          ? input.archivedAt
          : null,
    isPrimary: Boolean(input.isPrimary),
  };
}

function parseGlobalUserCompanyMappings(
  value: unknown,
): GlobalUserCompanyMapping[] {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? mapGlobalUserCompanyMappingRecord(entry as Record<string, unknown>)
        : null,
    )
    .filter((entry): entry is GlobalUserCompanyMapping => entry !== null)
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function mapGlobalUser(row: GlobalUserRow | undefined): GlobalUserView | null {
  if (!row || !isAppRole(row.role) || row.role === "superadmin") {
    return null;
  }

  const companyMappings = parseGlobalUserCompanyMappings(row.companyMappings);

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    phone: row.phone,
    role: row.role,
    roleLabel: ROLE_DEFINITIONS[row.role].label,
    status: getGlobalUserAccountStatus(row.isActive, row.suspendedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    suspendedAt: row.suspendedAt ? toIsoString(row.suspendedAt) : null,
    lastLoginAt: row.lastLoginAt ? toIsoString(row.lastLoginAt) : null,
    primaryCompany: companyMappings.find((entry) => entry.isPrimary) ?? companyMappings[0] ?? null,
    companyMappings,
  };
}

function mapGlobalUserProfile(
  row: GlobalUserProfileRow | undefined,
): GlobalUserProfile | null {
  const baseUser = mapGlobalUser(row);

  if (!baseUser || !row) {
    return null;
  }

  return {
    ...baseUser,
    personalEmail: row.personalEmail?.toLowerCase() ?? null,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    address: row.address,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }
      : null,
    designation: row.designationId
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
      : null,
  };
}

function mapGlobalUserCompanyOption(
  row: GlobalUserCompanyOptionRow,
) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status as GlobalUserCompanyMapping["status"],
    onboardingStatus:
      row.onboardingStatus as GlobalUserCompanyMapping["onboardingStatus"],
    archivedAt: row.archivedAt ? toIsoString(row.archivedAt) : null,
  };
}

function buildGlobalUserFilters(filters: GlobalUsersWorkspaceFilters = {}) {
  const values: unknown[] = [];
  const conditions = [`users.role <> 'superadmin'`];

  const search = typeof filters.search === "string" ? filters.search.trim() : "";

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(
      `(LOWER(users.full_name) LIKE $${values.length} OR LOWER(users.email) LIKE $${values.length})`,
    );
  }

  if (filters.role) {
    values.push(filters.role);
    conditions.push(`users.role = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(
      `(
        CASE
          WHEN users.is_active = FALSE AND users.suspended_at IS NOT NULL THEN 'suspended'
          WHEN users.is_active = TRUE THEN 'active'
          ELSE 'inactive'
        END
      ) = $${values.length}`,
    );
  }

  if (filters.companyId) {
    values.push(filters.companyId);
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM user_company_links AS filter_links
        WHERE filter_links.user_id = users.id
          AND filter_links.id = $${values.length}
      )`,
    );
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

function buildCompanyUserFilters(
  filters: CompanyUsersWorkspaceFilters = {},
  companyIdParameterIndex = 1,
) {
  const values: unknown[] = [];
  const conditions = [`users.role <> 'superadmin'`, COMPANY_USER_SCOPE_SQL.replace(/\$1/g, `$${companyIdParameterIndex}`)];

  const search = typeof filters.search === "string" ? filters.search.trim() : "";

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    const parameterIndex = companyIdParameterIndex + values.length;
    conditions.push(
      `(LOWER(users.full_name) LIKE $${parameterIndex} OR LOWER(users.email) LIKE $${parameterIndex} OR LOWER(users.role) LIKE $${parameterIndex} OR LOWER(COALESCE(users.employee_id, '')) LIKE $${parameterIndex})`,
    );
  }

  if (filters.role) {
    values.push(filters.role);
    const parameterIndex = companyIdParameterIndex + values.length;
    conditions.push(`users.role = $${parameterIndex}`);
  }

  if (filters.status) {
    values.push(filters.status === "active");
    const parameterIndex = companyIdParameterIndex + values.length;
    conditions.push(`users.is_active = $${parameterIndex}`);
  }

  if (filters.departmentId) {
    values.push(filters.departmentId);
    const parameterIndex = companyIdParameterIndex + values.length;
    conditions.push(`users.department_id = $${parameterIndex}`);
  }

  if (filters.office) {
    values.push(filters.office.toLowerCase());
    const parameterIndex = companyIdParameterIndex + values.length;
    conditions.push(`LOWER(COALESCE(users.work_location, '')) = $${parameterIndex}`);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

export const usersRepository = {
  async listAdminUsers() {
    const result = await query<AdminDirectoryRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email,
          is_active AS "isActive",
          created_at AS "createdAt"
        FROM users
        WHERE role = 'admin'
        ORDER BY full_name ASC, created_at DESC
      `,
    );

    return result.rows
      .map((row) => mapAdminDirectoryUser(row))
      .filter((row): row is AdminDirectoryUser => row !== null);
  },

  async createAdminUser(input: CreateAdminUserRecordInput) {
    const userId = randomUUID();

    return withTransaction(async (client) => {
      const insertResult = await client.query<AdminDirectoryRow>(
        `
          INSERT INTO users (
            id,
            full_name,
            email,
            role,
            company_id,
            permissions,
            password_hash,
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, 'admin', $4, $5::text[], $6, $7, NOW(), NOW())
          RETURNING
            id,
            full_name AS "fullName",
            email,
            is_active AS "isActive",
            created_at AS "createdAt"
        `,
        [
          userId,
          input.fullName,
          input.email,
          input.companyId ?? null,
          [],
          input.passwordHash,
          isUserAccountActive(input.status),
        ],
      );

      if (input.companyId) {
        await client.query(
          `
            INSERT INTO company_admins (
              company_id,
              admin_user_id,
              created_at,
              updated_at
            ) VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (company_id)
            DO UPDATE SET
              admin_user_id = EXCLUDED.admin_user_id,
              updated_at = NOW()
          `,
          [input.companyId, userId],
        );

        await client.query(
          "UPDATE companies SET updated_at = NOW() WHERE id = $1",
          [input.companyId],
        );
      }

      return mapAdminDirectoryUser(insertResult.rows[0]);
    });
  },

  async listCompanyUsers(
    companyId: string,
    filters: CompanyUsersWorkspaceFilters = {},
  ) {
    const safePage =
      Number.isInteger(filters.page) && (filters.page as number) > 0
        ? (filters.page as number)
        : 1;
    const safePageSize =
      Number.isInteger(filters.pageSize) && (filters.pageSize as number) > 0
        ? Math.min(filters.pageSize as number, 100)
        : 10;
    const offset = (safePage - 1) * safePageSize;
    const builtFilters = buildCompanyUserFilters(filters);
    const countResult = await query<{ totalItems: string }>(
      `
        SELECT COUNT(*)::text AS "totalItems"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        ${builtFilters.whereClause}
      `,
      [companyId, ...builtFilters.values],
    );
    const result = await query<CompanyUserRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.phone,
          users.employee_id AS "employeeId",
          users.role,
          users.is_active AS "isActive",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          users.work_location AS "workLocation",
          users.employment_type AS "employmentType",
          users.profile_photo_url AS "profilePhotoUrl",
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
          designation_departments.code AS "designationDepartmentCode",
          CASE
            WHEN today_leave.user_id IS NOT NULL THEN 'on-leave'
            WHEN today_attendance.id IS NOT NULL
              AND today_attendance.check_in_at > (
                date_trunc('day', NOW())
                + COALESCE(company_attendance_settings.default_shift_start, '09:30'::time)
                + COALESCE(company_attendance_settings.grace_time_minutes, 15) * INTERVAL '1 minute'
              ) THEN 'late'
            WHEN today_attendance.id IS NOT NULL THEN 'present'
            WHEN users.is_active = FALSE THEN 'absent'
            ELSE 'not-checked-in'
          END AS "todayAttendanceStatus",
          CASE
            WHEN today_leave.user_id IS NOT NULL THEN 'On Leave'
            WHEN today_attendance.id IS NOT NULL
              AND today_attendance.check_in_at > (
                date_trunc('day', NOW())
                + COALESCE(company_attendance_settings.default_shift_start, '09:30'::time)
                + COALESCE(company_attendance_settings.grace_time_minutes, 15) * INTERVAL '1 minute'
              ) THEN 'Late'
            WHEN today_attendance.id IS NOT NULL THEN 'Present'
            WHEN users.is_active = FALSE THEN 'Absent'
            ELSE 'Not Checked-in'
          END AS "todayAttendanceLabel",
          today_attendance.check_in_at AS "todayCheckInAt",
          today_attendance.check_out_at AS "todayCheckOutAt",
          COALESCE(monthly_attendance.present, 0) AS "monthlyPresent",
          COALESCE(monthly_attendance.late, 0) AS "monthlyLate",
          CASE
            WHEN users.is_active = FALSE THEN 1
            ELSE 0
          END AS "monthlyAbsent",
          COALESCE(monthly_leave.on_leave, 0) AS "monthlyOnLeave",
          COALESCE(user_documents.total_documents, 0) AS "documentsCount",
          CASE
            WHEN company_admin_owner.admin_user_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS "isCompanyAdminOwner"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        LEFT JOIN departments
          ON departments.id = users.department_id
          AND departments.company_id = $1
        LEFT JOIN designations
          ON designations.id = users.designation_id
          AND designations.company_id = $1
        LEFT JOIN departments AS designation_departments
          ON designation_departments.id = designations.department_id
          AND designation_departments.company_id = $1
        LEFT JOIN users AS reporting_manager
          ON reporting_manager.id = users.reporting_manager_id
          AND reporting_manager.company_id = $1
        LEFT JOIN company_attendance_settings
          ON company_attendance_settings.company_id = $1
        LEFT JOIN attendance_records AS today_attendance
          ON today_attendance.company_id = $1
          AND today_attendance.user_id = users.id
          AND today_attendance.attendance_date = CURRENT_DATE
        LEFT JOIN (
          SELECT DISTINCT user_id
          FROM leave_requests
          WHERE company_id = $1
            AND status = 'approved'
            AND CURRENT_DATE BETWEEN start_date AND end_date
        ) AS today_leave
          ON today_leave.user_id = users.id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (
              WHERE attendance_records.check_in_at <= (
                attendance_records.attendance_date::timestamp
                + COALESCE(company_attendance_settings.default_shift_start, '09:30'::time)
                + COALESCE(company_attendance_settings.grace_time_minutes, 15) * INTERVAL '1 minute'
              )
            )::int AS present,
            COUNT(*) FILTER (
              WHERE attendance_records.check_in_at > (
                attendance_records.attendance_date::timestamp
                + COALESCE(company_attendance_settings.default_shift_start, '09:30'::time)
                + COALESCE(company_attendance_settings.grace_time_minutes, 15) * INTERVAL '1 minute'
              )
            )::int AS late
          FROM attendance_records
          WHERE attendance_records.company_id = $1
            AND attendance_records.user_id = users.id
            AND attendance_records.attendance_date >= date_trunc('month', CURRENT_DATE)::date
            AND attendance_records.attendance_date <= CURRENT_DATE
        ) AS monthly_attendance ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS on_leave
          FROM leave_requests
          WHERE leave_requests.company_id = $1
            AND leave_requests.user_id = users.id
            AND leave_requests.status = 'approved'
            AND leave_requests.start_date <= CURRENT_DATE
            AND leave_requests.end_date >= date_trunc('month', CURRENT_DATE)::date
        ) AS monthly_leave ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total_documents
          FROM documents
          WHERE documents.company_id = $1
            AND documents.user_id = users.id
            AND documents.deleted_at IS NULL
        ) AS user_documents ON TRUE
        ${builtFilters.whereClause}
        ORDER BY
          CASE WHEN users.role = 'admin' THEN 0 ELSE 1 END,
          users.is_active DESC,
          users.role ASC,
          users.full_name ASC,
          users.created_at DESC
        LIMIT $${builtFilters.values.length + 2}
        OFFSET $${builtFilters.values.length + 3}
      `,
      [companyId, ...builtFilters.values, safePageSize, offset],
    );
    const totalItems = Number(countResult.rows[0]?.totalItems ?? "0");
    const items = result.rows
      .map((row) => mapCompanyUser(row))
      .filter((row): row is CompanyScopedUser => row !== null);

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
        totalItems,
      },
    };
  },

  async getCompanyUserRoleSummary(companyId: string) {
    const result = await query<CompanyUserSummaryRow>(
      `
        SELECT
          users.role,
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (WHERE users.is_active = TRUE)::int AS "activeUsers",
          COUNT(*) FILTER (WHERE users.is_active = FALSE)::int AS "inactiveUsers"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        WHERE (
          (users.role = 'admin' AND company_admin_owner.admin_user_id IS NOT NULL)
          OR (users.role <> 'admin' AND users.company_id = $1)
        )
        GROUP BY users.role
        ORDER BY users.role ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapCompanyUserRoleSummary(row))
      .filter((row): row is CompanyUserRoleSummary => row !== null);
  },

  async getCompanyUsersSummaryTotals(companyId: string) {
    const result = await query<CompanyUsersSummaryTotalsRow>(
      `
        SELECT
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (WHERE users.is_active = TRUE)::int AS "activeUsers",
          COUNT(*) FILTER (WHERE users.is_active = FALSE)::int AS "inactiveUsers",
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM leave_requests
              WHERE leave_requests.company_id = $1
                AND leave_requests.user_id = users.id
                AND leave_requests.status = 'approved'
                AND CURRENT_DATE BETWEEN leave_requests.start_date AND leave_requests.end_date
            )
          )::int AS "onLeaveToday",
          COUNT(*) FILTER (
            WHERE users.created_at >= date_trunc('month', NOW())
          )::int AS "newJoinersThisMonth",
          COUNT(*) FILTER (
            WHERE users.created_at >= date_trunc('month', NOW())
          )::int AS "employeeGrowthThisMonth",
          COUNT(*) FILTER (
            WHERE users.created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
              AND users.created_at < date_trunc('month', NOW())
          )::int AS "newJoinersPreviousMonth"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        WHERE ${COMPANY_USER_SCOPE_SQL}
          AND users.role <> 'superadmin'
      `,
      [companyId],
    );

    return (
      result.rows[0] ?? {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        onLeaveToday: 0,
        newJoinersThisMonth: 0,
        employeeGrowthThisMonth: 0,
        newJoinersPreviousMonth: 0,
      }
    );
  },

  async listCompanyUserDepartments(companyId: string) {
    const result = await query<CompanyUserProfileRow>(
      `
        SELECT DISTINCT
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          NULL::text AS id,
          NULL::text AS "fullName",
          NULL::text AS email,
          NULL::text AS role,
          TRUE AS "isActive",
          FALSE AS "isCompanyAdminOwner",
          NOW() AS "createdAt",
          NOW() AS "updatedAt",
          NULL::text AS "designationId",
          NULL::text AS "designationTitle",
          NULL::text AS "designationCode",
          NULL::text AS "designationDepartmentId",
          NULL::text AS "designationDepartmentName",
          NULL::text AS "designationDepartmentCode"
        FROM departments
        INNER JOIN users
          ON users.department_id = departments.id
          AND users.company_id = $1
        WHERE departments.company_id = $1
        ORDER BY departments.name ASC
      `,
      [companyId],
    );

    return result.rows
      .filter((row) => row.departmentId)
      .map(
        (row): CompanyUserDepartmentSummary => ({
          id: row.departmentId as string,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }),
      );
  },

  async listCompanyUserOfficeOptions(companyId: string) {
    const result = await query<CompanyOfficeOptionRow>(
      `
        SELECT DISTINCT TRIM(users.work_location) AS name
        FROM users
        WHERE users.company_id = $1
          AND users.work_location IS NOT NULL
          AND TRIM(users.work_location) <> ''

        UNION

        SELECT office_locations.name
        FROM office_locations
        WHERE office_locations.company_id = $1
          AND office_locations.is_active = TRUE

        ORDER BY name ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => row.name?.trim() ?? "")
      .filter((name) => name.length > 0);
  },

  async listActiveEmployeeHolidayTargets(companyId: string) {
    const result = await query<CompanyHolidayNotificationTargetRow>(
      `
        SELECT
          users.id,
          users.work_location AS "workLocation"
        FROM users
        WHERE users.company_id = $1
          AND users.role = 'employee'
          AND users.is_active = TRUE
        ORDER BY users.created_at ASC
      `,
      [companyId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workLocation: row.workLocation?.trim() ?? null,
    }));
  },

  async findCompanyUserById(companyId: string, userId: string) {
    const result = await query<CompanyUserRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role,
          users.is_active AS "isActive",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          users.profile_photo_url AS "profilePhotoUrl",
          CASE
            WHEN company_admin_owner.admin_user_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS "isCompanyAdminOwner"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        WHERE users.id = $2
          AND (
            (users.role = 'admin' AND company_admin_owner.admin_user_id IS NOT NULL)
            OR (users.role <> 'admin' AND users.company_id = $1)
          )
        LIMIT 1
      `,
      [companyId, userId],
    );

    return mapCompanyUser(result.rows[0]);
  },

  async listCompanyUserProfiles(companyId: string) {
    const result = await query<CompanyUserProfileRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role,
          users.is_active AS "isActive",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          users.profile_photo_url AS "profilePhotoUrl",
          CASE
            WHEN company_admin_owner.admin_user_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS "isCompanyAdminOwner",
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          designations.id AS "designationId",
          designations.title AS "designationTitle",
          designations.code AS "designationCode",
          designation_departments.id AS "designationDepartmentId",
          designation_departments.name AS "designationDepartmentName",
          designation_departments.code AS "designationDepartmentCode"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        LEFT JOIN departments
          ON departments.id = users.department_id
          AND departments.company_id = $1
        LEFT JOIN designations
          ON designations.id = users.designation_id
          AND designations.company_id = $1
        LEFT JOIN departments AS designation_departments
          ON designation_departments.id = designations.department_id
          AND designation_departments.company_id = $1
        WHERE (
          (users.role = 'admin' AND company_admin_owner.admin_user_id IS NOT NULL)
          OR (users.role <> 'admin' AND users.company_id = $1)
        )
        ORDER BY
          CASE WHEN users.role = 'admin' THEN 0 ELSE 1 END,
          users.full_name ASC,
          users.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapCompanyUserProfile(row))
      .filter((row): row is CompanyUserProfile => row !== null);
  },

  async findCompanyUserProfileById(companyId: string, userId: string) {
    const result = await query<CompanyUserProfileRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role,
          users.is_active AS "isActive",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          users.profile_photo_url AS "profilePhotoUrl",
          CASE
            WHEN company_admin_owner.admin_user_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS "isCompanyAdminOwner",
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          designations.id AS "designationId",
          designations.title AS "designationTitle",
          designations.code AS "designationCode",
          designation_departments.id AS "designationDepartmentId",
          designation_departments.name AS "designationDepartmentName",
          designation_departments.code AS "designationDepartmentCode"
        FROM users
        LEFT JOIN company_admins AS company_admin_owner
          ON company_admin_owner.company_id = $1
          AND company_admin_owner.admin_user_id = users.id
        LEFT JOIN departments
          ON departments.id = users.department_id
          AND departments.company_id = $1
        LEFT JOIN designations
          ON designations.id = users.designation_id
          AND designations.company_id = $1
        LEFT JOIN departments AS designation_departments
          ON designation_departments.id = designations.department_id
          AND designation_departments.company_id = $1
        WHERE users.id = $2
          AND (
            (users.role = 'admin' AND company_admin_owner.admin_user_id IS NOT NULL)
            OR (users.role <> 'admin' AND users.company_id = $1)
          )
        LIMIT 1
      `,
      [companyId, userId],
    );

    return mapCompanyUserProfile(result.rows[0]);
  },

  async createCompanyUser(input: CreateCompanyUserRecordInput) {
    const userId = randomUUID();
    const result = await query<CompanyUserRow>(
      `
        INSERT INTO users (
          id,
          full_name,
          email,
          role,
          company_id,
          permissions,
          password_hash,
          is_active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, NOW(), NOW())
        RETURNING
          id,
          full_name AS "fullName",
          email,
          role,
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          FALSE AS "isCompanyAdminOwner"
      `,
      [
        userId,
        input.fullName,
        input.email,
        input.role,
        input.companyId,
        [],
        input.passwordHash,
        isUserAccountActive(input.status),
      ],
    );

    return mapCompanyUser(result.rows[0]);
  },

  async updateCompanyUserStatus(
    companyId: string,
    userId: string,
    status: CompanyScopedUser["status"],
  ) {
    const result = await query<CompanyUserRow>(
      `
        UPDATE users
        SET
          is_active = $3,
          updated_at = NOW()
        WHERE id = $2
          AND company_id = $1
          AND role <> 'admin'
        RETURNING
          id,
          full_name AS "fullName",
          email,
          role,
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          FALSE AS "isCompanyAdminOwner"
      `,
      [companyId, userId, isUserAccountActive(status)],
    );

    return mapCompanyUser(result.rows[0]);
  },

  async updateCompanyUser(
    companyId: string,
    userId: string,
    input: UpdateCompanyUserRequest,
  ) {
    const result = await query<CompanyUserRow>(
      `
        UPDATE users
        SET
          full_name = COALESCE($3, full_name),
          email = COALESCE($4, email),
          role = COALESCE($5, role),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
        WHERE id = $2
          AND company_id = $1
          AND role <> 'admin'
        RETURNING
          id,
          full_name AS "fullName",
          email,
          role,
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          FALSE AS "isCompanyAdminOwner"
      `,
      [
        companyId,
        userId,
        input.fullName ?? null,
        input.email ?? null,
        input.role ?? null,
        typeof input.status === "string"
          ? isUserAccountActive(input.status)
          : null,
      ],
    );

    return mapCompanyUser(result.rows[0]);
  },

  async resetCompanyUserPassword(
    companyId: string,
    userId: string,
    passwordHash: string,
  ) {
    return withTransaction(async (client) => {
      const result = await client.query<CompanyUserRow>(
        `
          UPDATE users
          SET
            password_hash = $3,
            password_version = password_version + 1,
            updated_at = NOW()
          WHERE id = $2
            AND company_id = $1
            AND role <> 'admin'
          RETURNING
            id,
            full_name AS "fullName",
            email,
            role,
            is_active AS "isActive",
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            FALSE AS "isCompanyAdminOwner"
        `,
        [companyId, userId, passwordHash],
      );

      if (!result.rows[0]) {
        return null;
      }

      await client.query(
        `
          UPDATE user_sessions
          SET
            is_revoked = TRUE,
            revoked_at = NOW(),
            updated_at = NOW()
          WHERE user_id = $1
            AND is_revoked = FALSE
        `,
        [userId],
      );

      return mapCompanyUser(result.rows[0]);
    });
  },

  async setCompanyUserPassword(
    companyId: string,
    userId: string,
    passwordHash: string,
  ) {
    return this.resetCompanyUserPassword(companyId, userId, passwordHash);
  },

  async deleteCompanyUser(companyId: string, userId: string) {
    const result = await query<{ id: string }>(
      `
        DELETE FROM users
        WHERE id = $2
          AND company_id = $1
          AND role <> 'admin'
        RETURNING id
      `,
      [companyId, userId],
    );

    return result.rows[0]?.id ?? null;
  },

  async getGlobalUsersSummaryTotals() {
    const result = await query<GlobalUserSummaryTotalsRow>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (
            WHERE users.is_active = TRUE
          )::int AS "activeUsers",
          COUNT(*) FILTER (
            WHERE users.is_active = FALSE
              AND users.suspended_at IS NULL
          )::int AS "inactiveUsers",
          COUNT(*) FILTER (
            WHERE users.is_active = FALSE
              AND users.suspended_at IS NOT NULL
          )::int AS "suspendedUsers",
          (
            SELECT COUNT(DISTINCT user_company_links.id)::int
            FROM user_company_links
          ) AS "totalCompanies"
        FROM users
        WHERE users.role <> 'superadmin'
      `,
    );

    return (
      result.rows[0] ?? {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        suspendedUsers: 0,
        totalCompanies: 0,
      }
    );
  },

  async listGlobalUserCompanies() {
    const result = await query<GlobalUserCompanyOptionRow>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT DISTINCT
          user_company_links.id,
          user_company_links.name,
          user_company_links.code,
          user_company_links.status,
          user_company_links."onboardingStatus",
          user_company_links."archivedAt"
        FROM user_company_links
        ORDER BY user_company_links.name ASC, user_company_links.code ASC
      `,
    );

    return result.rows.map((row) => mapGlobalUserCompanyOption(row));
  },

  async listGlobalUsers(filters: GlobalUsersWorkspaceFilters = {}) {
    const safePage =
      Number.isInteger(filters.page) && (filters.page as number) > 0
        ? (filters.page as number)
        : 1;
    const safePageSize =
      Number.isInteger(filters.pageSize) && (filters.pageSize as number) > 0
        ? Math.min(filters.pageSize as number, 100)
        : 25;
    const offset = (safePage - 1) * safePageSize;
    const builtFilters = buildGlobalUserFilters(filters);
    const countResult = await query<{ totalItems: string }>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT COUNT(*)::text AS "totalItems"
        FROM users
        ${builtFilters.whereClause}
      `,
      builtFilters.values,
    );
    const result = await query<GlobalUserRow>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.phone,
          users.role,
          users.is_active AS "isActive",
          users.suspended_at AS "suspendedAt",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          NULL::timestamptz AS "lastLoginAt",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', user_company_links.id,
                'name', user_company_links.name,
                'code', user_company_links.code,
                'status', user_company_links.status,
                'onboardingStatus', user_company_links."onboardingStatus",
                'archivedAt', user_company_links."archivedAt",
                'isPrimary', user_company_links."isPrimary"
              )
            ) FILTER (WHERE user_company_links.id IS NOT NULL),
            '[]'::jsonb
          ) AS "companyMappings"
        FROM users
        LEFT JOIN user_company_links
          ON user_company_links.user_id = users.id
        ${builtFilters.whereClause}
        GROUP BY
          users.id,
          users.full_name,
          users.email,
          users.phone,
          users.role,
          users.is_active,
          users.suspended_at,
          users.created_at,
          users.updated_at
        ORDER BY
          CASE WHEN users.role = 'admin' THEN 0 ELSE 1 END,
          CASE
            WHEN users.is_active = TRUE THEN 0
            WHEN users.suspended_at IS NOT NULL THEN 1
            ELSE 2
          END,
          users.full_name ASC,
          users.created_at DESC
        LIMIT $${builtFilters.values.length + 1}
        OFFSET $${builtFilters.values.length + 2}
      `,
      [...builtFilters.values, safePageSize, offset],
    );
    const totalItems = Number(countResult.rows[0]?.totalItems ?? "0");
    const items = result.rows
      .map((row) => mapGlobalUser(row))
      .filter((row): row is GlobalUserView => row !== null);

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
        totalItems,
      },
    };
  },

  async findGlobalUserById(userId: string) {
    const result = await query<GlobalUserRow>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.phone,
          users.role,
          users.is_active AS "isActive",
          users.suspended_at AS "suspendedAt",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          NULL::timestamptz AS "lastLoginAt",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', user_company_links.id,
                'name', user_company_links.name,
                'code', user_company_links.code,
                'status', user_company_links.status,
                'onboardingStatus', user_company_links."onboardingStatus",
                'archivedAt', user_company_links."archivedAt",
                'isPrimary', user_company_links."isPrimary"
              )
            ) FILTER (WHERE user_company_links.id IS NOT NULL),
            '[]'::jsonb
          ) AS "companyMappings"
        FROM users
        LEFT JOIN user_company_links
          ON user_company_links.user_id = users.id
        WHERE users.id = $1
          AND users.role <> 'superadmin'
        GROUP BY
          users.id,
          users.full_name,
          users.email,
          users.phone,
          users.role,
          users.is_active,
          users.suspended_at,
          users.created_at,
          users.updated_at
        LIMIT 1
      `,
      [userId],
    );

    return mapGlobalUser(result.rows[0]);
  },

  async findGlobalUserProfileById(userId: string) {
    const result = await query<GlobalUserProfileRow>(
      `
        WITH user_company_links AS (
          ${GLOBAL_USER_COMPANY_LINKS_SQL}
        )
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.phone,
          users.role,
          users.is_active AS "isActive",
          users.suspended_at AS "suspendedAt",
          users.created_at AS "createdAt",
          users.updated_at AS "updatedAt",
          NULL::timestamptz AS "lastLoginAt",
          users.personal_email AS "personalEmail",
          users.emergency_contact_name AS "emergencyContactName",
          users.emergency_contact_phone AS "emergencyContactPhone",
          users.address,
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          designations.id AS "designationId",
          designations.title AS "designationTitle",
          designations.code AS "designationCode",
          designation_departments.id AS "designationDepartmentId",
          designation_departments.name AS "designationDepartmentName",
          designation_departments.code AS "designationDepartmentCode",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', user_company_links.id,
                'name', user_company_links.name,
                'code', user_company_links.code,
                'status', user_company_links.status,
                'onboardingStatus', user_company_links."onboardingStatus",
                'archivedAt', user_company_links."archivedAt",
                'isPrimary', user_company_links."isPrimary"
              )
            ) FILTER (WHERE user_company_links.id IS NOT NULL),
            '[]'::jsonb
          ) AS "companyMappings"
        FROM users
        LEFT JOIN departments
          ON departments.id = users.department_id
          AND departments.company_id = users.company_id
        LEFT JOIN designations
          ON designations.id = users.designation_id
          AND designations.company_id = users.company_id
        LEFT JOIN departments AS designation_departments
          ON designation_departments.id = designations.department_id
          AND designation_departments.company_id = users.company_id
        LEFT JOIN user_company_links
          ON user_company_links.user_id = users.id
        WHERE users.id = $1
          AND users.role <> 'superadmin'
        GROUP BY
          users.id,
          users.full_name,
          users.email,
          users.phone,
          users.role,
          users.is_active,
          users.suspended_at,
          users.created_at,
          users.updated_at,
          users.personal_email,
          users.emergency_contact_name,
          users.emergency_contact_phone,
          users.address,
          departments.id,
          departments.name,
          departments.code,
          designations.id,
          designations.title,
          designations.code,
          designation_departments.id,
          designation_departments.name,
          designation_departments.code
        LIMIT 1
      `,
      [userId],
    );

    return mapGlobalUserProfile(result.rows[0]);
  },

  async updateGlobalUser(
    userId: string,
    input: UpdateGlobalUserRequest & {
      isActive?: boolean | null;
      setSuspendedAt?: boolean | null;
      suspendedAt?: string | null;
    },
  ) {
    const result = await query<{ id: string }>(
      `
        UPDATE users
        SET
          full_name = COALESCE($2, full_name),
          email = COALESCE($3, email),
          is_active = COALESCE($4, is_active),
          suspended_at = CASE
            WHEN $5::boolean IS NULL THEN suspended_at
            WHEN $5::boolean = TRUE THEN $6::timestamptz
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = $1
          AND role <> 'superadmin'
        RETURNING id
      `,
      [
        userId,
        input.fullName ?? null,
        input.email ?? null,
        typeof input.isActive === "boolean" ? input.isActive : null,
        typeof input.setSuspendedAt === "boolean" ? input.setSuspendedAt : null,
        input.suspendedAt ?? null,
      ],
    );

    if (!result.rows[0]?.id) {
      return null;
    }

    return this.findGlobalUserById(userId);
  },

  async updateGlobalUserAccountState(
    userId: string,
    input: {
      isActive: boolean;
      suspendedAt: string | null;
    },
  ) {
    return this.updateGlobalUser(userId, {
      isActive: input.isActive,
      setSuspendedAt: true,
      suspendedAt: input.suspendedAt,
    });
  },

  async resetGlobalUserPassword(userId: string, passwordHash: string) {
    return withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `
          UPDATE users
          SET
            password_hash = $2,
            password_version = password_version + 1,
            updated_at = NOW()
          WHERE id = $1
            AND role <> 'superadmin'
          RETURNING id
        `,
        [userId, passwordHash],
      );

      if (!result.rows[0]?.id) {
        return null;
      }

      await client.query(
        `
          UPDATE user_sessions
          SET
            is_revoked = TRUE,
            revoked_at = NOW(),
            updated_at = NOW()
          WHERE user_id = $1
            AND is_revoked = FALSE
        `,
        [userId],
      );

      return this.findGlobalUserById(userId);
    });
  },

  async forceLogoutGlobalUser(userId: string) {
    return withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `
          UPDATE users
          SET
            password_version = password_version + 1,
            updated_at = NOW()
          WHERE id = $1
            AND role <> 'superadmin'
          RETURNING id
        `,
        [userId],
      );

      if (!result.rows[0]?.id) {
        return null;
      }

      await client.query(
        `
          UPDATE user_sessions
          SET
            is_revoked = TRUE,
            revoked_at = NOW(),
            updated_at = NOW()
          WHERE user_id = $1
            AND is_revoked = FALSE
        `,
        [userId],
      );

      return this.findGlobalUserById(userId);
    });
  },

  async deleteGlobalUser(userId: string) {
    const result = await query<{ id: string }>(
      `
        DELETE FROM users
        WHERE id = $1
          AND role <> 'superadmin'
        RETURNING id
      `,
      [userId],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateCompanyUserOrganizationProfile(
    companyId: string,
    userId: string,
    input: {
      departmentId: string | null;
      designationId: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? { query };
    const updateResult = await database.query<{ id: string }>(
      `
        UPDATE users
        SET
          department_id = $3,
          designation_id = $4,
          updated_at = NOW()
        WHERE id = $2
          AND (
            (
              users.role = 'admin'
              AND EXISTS (
                SELECT 1
                FROM company_admins
                WHERE company_admins.company_id = $1
                  AND company_admins.admin_user_id = users.id
              )
            )
            OR (users.role <> 'admin' AND users.company_id = $1)
          )
        RETURNING id
      `,
      [companyId, userId, input.departmentId, input.designationId],
    );

    if (!updateResult.rows[0]?.id) {
      return null;
    }

    return this.findCompanyUserProfileById(companyId, userId);
  },
};
