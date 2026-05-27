import { randomUUID } from "node:crypto";
import { query } from "../../database/index.js";
import type {
  CreateDepartmentInput,
  DepartmentDirectoryEmployee,
  DepartmentDirectoryView,
  DepartmentView,
} from "./departments.types.js";

type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  designationCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type DepartmentDirectoryRow = DepartmentRow & {
  employeeCount: number | string;
  activeEmployeeCount: number | string;
  inactiveEmployeeCount: number | string;
  officeLocation: string | null;
  departmentHead: unknown;
  employees: unknown;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeEmployeeStatus(value: unknown): "active" | "inactive" {
  return value === "active" ? "active" : "inactive";
}

function mapDirectoryEmployee(value: unknown): DepartmentDirectoryEmployee | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.fullName !== "string" ||
    typeof record.email !== "string" ||
    typeof record.role !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email.toLowerCase(),
    role: record.role,
    designationTitle:
      typeof record.designationTitle === "string"
        ? record.designationTitle
        : null,
    status: normalizeEmployeeStatus(record.status),
    profilePhotoUrl:
      typeof record.profilePhotoUrl === "string" ? record.profilePhotoUrl : null,
  };
}

function mapDepartment(row: DepartmentRow | undefined): DepartmentView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    designationCount: row.designationCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapDirectoryDepartment(
  row: DepartmentDirectoryRow | undefined,
): DepartmentDirectoryView | null {
  const department = mapDepartment(row);

  if (!department || !row) {
    return null;
  }

  const employees = Array.isArray(row.employees)
    ? row.employees
        .map((employee) => mapDirectoryEmployee(employee))
        .filter((employee): employee is DepartmentDirectoryEmployee => employee !== null)
    : [];
  const departmentHead = mapDirectoryEmployee(row.departmentHead);
  const activeEmployeeCount = toNumber(row.activeEmployeeCount);

  return {
    ...department,
    status: activeEmployeeCount > 0 ? "active" : "inactive",
    employeeCount: toNumber(row.employeeCount),
    activeEmployeeCount,
    inactiveEmployeeCount: toNumber(row.inactiveEmployeeCount),
    officeLocation: row.officeLocation,
    departmentHead,
    employees,
  };
}

export const departmentsRepository = {
  async listCompanyDepartments(companyId: string) {
    const result = await query<DepartmentRow>(
      `
        SELECT
          departments.id,
          departments.name,
          departments.code,
          departments.description,
          COUNT(designations.id)::int AS "designationCount",
          departments.created_at AS "createdAt",
          departments.updated_at AS "updatedAt"
        FROM departments
        LEFT JOIN designations
          ON designations.department_id = departments.id
          AND designations.company_id = departments.company_id
        WHERE departments.company_id = $1
        GROUP BY departments.id
        ORDER BY departments.name ASC, departments.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapDepartment(row))
      .filter((row): row is DepartmentView => row !== null);
  },

  async findCompanyDepartmentById(companyId: string, departmentId: string) {
    const result = await query<DepartmentRow>(
      `
        SELECT
          departments.id,
          departments.name,
          departments.code,
          departments.description,
          COUNT(designations.id)::int AS "designationCount",
          departments.created_at AS "createdAt",
          departments.updated_at AS "updatedAt"
        FROM departments
        LEFT JOIN designations
          ON designations.department_id = departments.id
          AND designations.company_id = departments.company_id
        WHERE departments.company_id = $1
          AND departments.id = $2
        GROUP BY departments.id
        LIMIT 1
      `,
      [companyId, departmentId],
    );

    return mapDepartment(result.rows[0]);
  },

  async listCompanyDepartmentDirectory(companyId: string) {
    const result = await query<DepartmentDirectoryRow>(
      `
        SELECT
          departments.id,
          departments.name,
          departments.code,
          departments.description,
          COUNT(DISTINCT designations.id)::int AS "designationCount",
          COUNT(DISTINCT department_users.id)::int AS "employeeCount",
          COUNT(DISTINCT department_users.id) FILTER (
            WHERE department_users.is_active = TRUE
          )::int AS "activeEmployeeCount",
          COUNT(DISTINCT department_users.id) FILTER (
            WHERE department_users.is_active = FALSE
          )::int AS "inactiveEmployeeCount",
          location_summary.work_location AS "officeLocation",
          CASE
            WHEN department_head.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', department_head.id,
              'fullName', department_head.full_name,
              'email', department_head.email,
              'role', department_head.role,
              'designationTitle', department_head_designation.title,
              'status', CASE WHEN department_head.is_active THEN 'active' ELSE 'inactive' END,
              'profilePhotoUrl', department_head.profile_photo_url
            )
          END AS "departmentHead",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', department_users.id,
                'fullName', department_users.full_name,
                'email', department_users.email,
                'role', department_users.role,
                'designationTitle', user_designations.title,
                'status', CASE WHEN department_users.is_active THEN 'active' ELSE 'inactive' END,
                'profilePhotoUrl', department_users.profile_photo_url
              )
            ) FILTER (WHERE department_users.id IS NOT NULL),
            '[]'::jsonb
          ) AS employees,
          departments.created_at AS "createdAt",
          departments.updated_at AS "updatedAt"
        FROM departments
        LEFT JOIN designations
          ON designations.department_id = departments.id
          AND designations.company_id = departments.company_id
        LEFT JOIN users AS department_users
          ON department_users.department_id = departments.id
          AND department_users.company_id = departments.company_id
        LEFT JOIN designations AS user_designations
          ON user_designations.id = department_users.designation_id
          AND user_designations.company_id = departments.company_id
        LEFT JOIN LATERAL (
          SELECT users.work_location
          FROM users
          WHERE users.company_id = departments.company_id
            AND users.department_id = departments.id
            AND users.work_location IS NOT NULL
            AND BTRIM(users.work_location) <> ''
          GROUP BY users.work_location
          ORDER BY COUNT(*) DESC, users.work_location ASC
          LIMIT 1
        ) AS location_summary ON TRUE
        LEFT JOIN LATERAL (
          SELECT users.*
          FROM users
          WHERE users.company_id = departments.company_id
            AND users.department_id = departments.id
          ORDER BY
            users.is_active DESC,
            CASE users.role
              WHEN 'hr' THEN 1
              WHEN 'project-manager' THEN 2
              WHEN 'team-lead' THEN 3
              WHEN 'accounts' THEN 4
              WHEN 'employee' THEN 5
              WHEN 'admin' THEN 6
              ELSE 7
            END,
            users.full_name ASC
          LIMIT 1
        ) AS department_head ON TRUE
        LEFT JOIN designations AS department_head_designation
          ON department_head_designation.id = department_head.designation_id
          AND department_head_designation.company_id = departments.company_id
        WHERE departments.company_id = $1
        GROUP BY
          departments.id,
          location_summary.work_location,
          department_head.id,
          department_head.full_name,
          department_head.email,
          department_head.role,
          department_head.is_active,
          department_head.profile_photo_url,
          department_head_designation.title
        ORDER BY departments.name ASC, departments.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapDirectoryDepartment(row))
      .filter((row): row is DepartmentDirectoryView => row !== null);
  },

  async createCompanyDepartment(input: CreateDepartmentInput) {
    const result = await query<DepartmentRow>(
      `
        INSERT INTO departments (
          id,
          company_id,
          name,
          code,
          description,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING
          id,
          name,
          code,
          description,
          0::int AS "designationCount",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.name,
        input.code,
        input.description ?? null,
      ],
    );

    return mapDepartment(result.rows[0]);
  },

  async updateCompanyDepartment(
    companyId: string,
    departmentId: string,
    input: Omit<CreateDepartmentInput, "companyId">,
  ) {
    const result = await query<DepartmentRow>(
      `
        UPDATE departments
        SET
          name = $3,
          code = $4,
          description = $5,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          name,
          code,
          description,
          (
            SELECT COUNT(*)::int
            FROM designations
            WHERE designations.company_id = departments.company_id
              AND designations.department_id = departments.id
          ) AS "designationCount",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        departmentId,
        input.name,
        input.code,
        input.description ?? null,
      ],
    );

    return mapDepartment(result.rows[0]);
  },
};
