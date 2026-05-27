import { randomUUID } from "node:crypto";
import { query } from "../../database/index.js";
import type {
  CreateDesignationInput,
  DesignationDirectoryEmployee,
  DesignationDirectoryView,
  DesignationView,
} from "./designations.types.js";

type DesignationRow = {
  id: string;
  title: string;
  code: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type DesignationDirectoryRow = DesignationRow & {
  employeeCount: number | string;
  activeEmployeeCount: number | string;
  inactiveEmployeeCount: number | string;
  employees: unknown;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapDirectoryEmployee(value: unknown): DesignationDirectoryEmployee | null {
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
    departmentName:
      typeof record.departmentName === "string" ? record.departmentName : null,
    status: record.status === "active" ? "active" : "inactive",
    profilePhotoUrl:
      typeof record.profilePhotoUrl === "string" ? record.profilePhotoUrl : null,
  };
}

function mapDesignation(row: DesignationRow | undefined): DesignationView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    code: row.code,
    description: row.description,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }
      : null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapDirectoryDesignation(
  row: DesignationDirectoryRow | undefined,
): DesignationDirectoryView | null {
  const designation = mapDesignation(row);

  if (!designation || !row) {
    return null;
  }

  const employees = Array.isArray(row.employees)
    ? row.employees
        .map((employee) => mapDirectoryEmployee(employee))
        .filter((employee): employee is DesignationDirectoryEmployee => employee !== null)
    : [];
  const activeEmployeeCount = toNumber(row.activeEmployeeCount);

  return {
    ...designation,
    status: activeEmployeeCount > 0 ? "active" : "inactive",
    employeeCount: toNumber(row.employeeCount),
    activeEmployeeCount,
    inactiveEmployeeCount: toNumber(row.inactiveEmployeeCount),
    employees,
  };
}

export const designationsRepository = {
  async listCompanyDesignations(companyId: string) {
    const result = await query<DesignationRow>(
      `
        SELECT
          designations.id,
          designations.title,
          designations.code,
          designations.description,
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          designations.created_at AS "createdAt",
          designations.updated_at AS "updatedAt"
        FROM designations
        LEFT JOIN departments
          ON departments.id = designations.department_id
          AND departments.company_id = designations.company_id
        WHERE designations.company_id = $1
        ORDER BY designations.title ASC, designations.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapDesignation(row))
      .filter((row): row is DesignationView => row !== null);
  },

  async findCompanyDesignationById(companyId: string, designationId: string) {
    const result = await query<DesignationRow>(
      `
        SELECT
          designations.id,
          designations.title,
          designations.code,
          designations.description,
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          designations.created_at AS "createdAt",
          designations.updated_at AS "updatedAt"
        FROM designations
        LEFT JOIN departments
          ON departments.id = designations.department_id
          AND departments.company_id = designations.company_id
        WHERE designations.company_id = $1
          AND designations.id = $2
        LIMIT 1
      `,
      [companyId, designationId],
    );

    return mapDesignation(result.rows[0]);
  },

  async listCompanyDesignationDirectory(companyId: string) {
    const result = await query<DesignationDirectoryRow>(
      `
        SELECT
          designations.id,
          designations.title,
          designations.code,
          designations.description,
          departments.id AS "departmentId",
          departments.name AS "departmentName",
          departments.code AS "departmentCode",
          COUNT(DISTINCT designation_users.id)::int AS "employeeCount",
          COUNT(DISTINCT designation_users.id) FILTER (
            WHERE designation_users.is_active = TRUE
          )::int AS "activeEmployeeCount",
          COUNT(DISTINCT designation_users.id) FILTER (
            WHERE designation_users.is_active = FALSE
          )::int AS "inactiveEmployeeCount",
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', designation_users.id,
                'fullName', designation_users.full_name,
                'email', designation_users.email,
                'role', designation_users.role,
                'departmentName', user_departments.name,
                'status', CASE WHEN designation_users.is_active THEN 'active' ELSE 'inactive' END,
                'profilePhotoUrl', designation_users.profile_photo_url
              )
            ) FILTER (WHERE designation_users.id IS NOT NULL),
            '[]'::jsonb
          ) AS employees,
          designations.created_at AS "createdAt",
          designations.updated_at AS "updatedAt"
        FROM designations
        LEFT JOIN departments
          ON departments.id = designations.department_id
          AND departments.company_id = designations.company_id
        LEFT JOIN users AS designation_users
          ON designation_users.designation_id = designations.id
          AND designation_users.company_id = designations.company_id
        LEFT JOIN departments AS user_departments
          ON user_departments.id = designation_users.department_id
          AND user_departments.company_id = designations.company_id
        WHERE designations.company_id = $1
        GROUP BY designations.id, departments.id, departments.name, departments.code
        ORDER BY designations.title ASC, designations.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapDirectoryDesignation(row))
      .filter((row): row is DesignationDirectoryView => row !== null);
  },

  async createCompanyDesignation(input: CreateDesignationInput) {
    const result = await query<DesignationRow>(
      `
        INSERT INTO designations (
          id,
          company_id,
          department_id,
          title,
          code,
          description,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING
          id,
          title,
          code,
          description,
          (
            SELECT departments.id
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentId",
          (
            SELECT departments.name
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentName",
          (
            SELECT departments.code
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentCode",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.departmentId ?? null,
        input.title,
        input.code,
        input.description ?? null,
      ],
    );

    return mapDesignation(result.rows[0]);
  },

  async updateCompanyDesignation(
    companyId: string,
    designationId: string,
    input: Omit<CreateDesignationInput, "companyId">,
  ) {
    const result = await query<DesignationRow>(
      `
        UPDATE designations
        SET
          department_id = $3,
          title = $4,
          code = $5,
          description = $6,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          title,
          code,
          description,
          (
            SELECT departments.id
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentId",
          (
            SELECT departments.name
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentName",
          (
            SELECT departments.code
            FROM departments
            WHERE departments.id = designations.department_id
              AND departments.company_id = designations.company_id
          ) AS "departmentCode",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        designationId,
        input.departmentId ?? null,
        input.title,
        input.code,
        input.description ?? null,
      ],
    );

    return mapDesignation(result.rows[0]);
  },
};
