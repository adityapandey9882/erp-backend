import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../../database/index.js";
import type { DatabaseExecutor } from "../../database/query.js";
import {
  COMPANY_MODULE_DEFINITIONS,
  COMPANY_MODULE_KEYS,
  isCompanyOnboardingStatus,
  isCompanyStatus,
  normalizeCompanyModules,
  type CompanyAdminCandidate,
  type CompanyModuleDefinition,
  type CompanyOnboardingStatus,
  type CompanyRecord,
  type CompanyStatus,
} from "./companies.types.js";
import { policiesRepository } from "../policies/policies.repository.js";
import { superadminSettingsRepository } from "../superadmin/superadmin-settings.repository.js";

type CompanyRow = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactEmail: string;
  logoUrl: string | null;
  status: string;
  onboardingStatus: string;
  archivedAt: Date | string | null;
  assignedAdminUserId: string | null;
  enabledModules: string[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CompanyAdminRow = {
  id: string;
  fullName: string;
  email: string;
};

type CountRow = {
  count: string;
};

export type CompanyDeleteBlocker = {
  code: string;
  label: string;
  count: number;
};

export type CompanyDependencySummaryItem = CompanyDeleteBlocker;

type DeleteBlockerDefinition = {
  code: CompanyDeleteBlocker["code"];
  label: CompanyDeleteBlocker["label"];
  query: string;
};

const defaultExecutor: DatabaseExecutor = {
  query,
};

const COMPANY_DELETE_BLOCKERS: readonly DeleteBlockerDefinition[] = [
  {
    code: "admins",
    label: "admin assignments",
    query: "SELECT COUNT(*) AS count FROM company_admins WHERE company_id = $1",
  },
  {
    code: "users",
    label: "company users",
    query:
      "SELECT COUNT(*) AS count FROM users WHERE company_id = $1 AND role <> 'superadmin'",
  },
  {
    code: "departments",
    label: "departments",
    query: "SELECT COUNT(*) AS count FROM departments WHERE company_id = $1",
  },
  {
    code: "designations",
    label: "designations",
    query: "SELECT COUNT(*) AS count FROM designations WHERE company_id = $1",
  },
  {
    code: "roles",
    label: "company roles",
    query: "SELECT COUNT(*) AS count FROM roles WHERE company_id = $1",
  },
  {
    code: "attendance",
    label: "attendance records",
    query:
      "SELECT COUNT(*) AS count FROM attendance_records WHERE company_id = $1",
  },
  {
    code: "attendance-corrections",
    label: "attendance corrections",
    query:
      "SELECT COUNT(*) AS count FROM attendance_corrections WHERE company_id = $1",
  },
  {
    code: "leave",
    label: "leave requests",
    query: "SELECT COUNT(*) AS count FROM leave_requests WHERE company_id = $1",
  },
  {
    code: "salary-structures",
    label: "salary structures",
    query:
      "SELECT COUNT(*) AS count FROM salary_structures WHERE company_id = $1",
  },
  {
    code: "payroll-runs",
    label: "payroll runs",
    query: "SELECT COUNT(*) AS count FROM payroll_runs WHERE company_id = $1",
  },
  {
    code: "assets",
    label: "assets",
    query: "SELECT COUNT(*) AS count FROM company_assets WHERE company_id = $1",
  },
  {
    code: "asset-procurements",
    label: "asset procurements",
    query:
      "SELECT COUNT(*) AS count FROM asset_procurements WHERE company_id = $1",
  },
  {
    code: "documents",
    label: "documents",
    query: "SELECT COUNT(*) AS count FROM documents WHERE company_id = $1",
  },
  {
    code: "onboarding",
    label: "onboarding requests",
    query:
      "SELECT COUNT(*) AS count FROM onboarding_requests WHERE company_id = $1",
  },
  {
    code: "offboarding",
    label: "offboarding requests",
    query:
      "SELECT COUNT(*) AS count FROM offboarding_requests WHERE company_id = $1",
  },
  {
    code: "shifts",
    label: "shifts",
    query: "SELECT COUNT(*) AS count FROM shifts WHERE company_id = $1",
  },
];

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapCompanyRecord(row: CompanyRow | undefined): CompanyRecord | null {
  if (
    !row ||
    !isCompanyStatus(row.status) ||
    !isCompanyOnboardingStatus(row.onboardingStatus)
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    contactEmail: row.contactEmail,
    logoUrl: row.logoUrl,
    status: row.status,
    onboardingStatus: row.onboardingStatus,
    archivedAt: row.archivedAt ? toIsoString(row.archivedAt) : null,
    assignedAdminUserId: row.assignedAdminUserId,
    enabledModules: normalizeCompanyModules(row.enabledModules ?? []),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapAdmin(row: CompanyAdminRow): CompanyAdminCandidate {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
  };
}

async function readCompanyDependencySummary(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const summary: CompanyDependencySummaryItem[] = [];

  for (const definition of COMPANY_DELETE_BLOCKERS) {
    summary.push({
      code: definition.code,
      label: definition.label,
      count: await readScopedCount(executor, definition.query, companyId),
    });
  }

  return summary;
}

async function selectCompanyRecord(
  executor: DatabaseExecutor,
  clause: string,
  params: unknown[],
) {
  const result = await executor.query<CompanyRow>(
    `
      SELECT
        companies.id,
        companies.name,
        companies.code,
        companies.industry,
        companies.contact_email AS "contactEmail",
        companies.logo_url AS "logoUrl",
        companies.status,
        companies.onboarding_status AS "onboardingStatus",
        companies.archived_at AS "archivedAt",
        company_admins.admin_user_id AS "assignedAdminUserId",
        COALESCE(
          ARRAY_AGG(company_modules.module_key ORDER BY company_modules.module_key)
            FILTER (WHERE company_modules.is_enabled),
          '{}'::text[]
        ) AS "enabledModules",
        companies.created_at AS "createdAt",
        companies.updated_at AS "updatedAt"
      FROM companies
      LEFT JOIN company_admins
        ON company_admins.company_id = companies.id
      LEFT JOIN company_modules
        ON company_modules.company_id = companies.id
      ${clause}
      GROUP BY
        companies.id,
        company_admins.admin_user_id
      LIMIT 1
    `,
    params,
  );

  return mapCompanyRecord(result.rows[0]);
}

async function writeCompanyModules(
  executor: DatabaseExecutor,
  companyId: string,
  enabledModules: readonly string[],
) {
  const enabledSet = new Set(normalizeCompanyModules(enabledModules));

  await executor.query("DELETE FROM company_modules WHERE company_id = $1", [
    companyId,
  ]);

  for (const moduleKey of COMPANY_MODULE_KEYS) {
    await executor.query(
      `
        INSERT INTO company_modules (
          company_id,
          module_key,
          is_enabled,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
      `,
      [companyId, moduleKey, enabledSet.has(moduleKey)],
    );
  }
}

async function readScopedCount(
  executor: DatabaseExecutor,
  statement: string,
  companyId: string,
) {
  const result = await executor.query<CountRow>(statement, [companyId]);

  return Number(result.rows[0]?.count ?? 0);
}

export const companiesRepository = {
  async listCompanies() {
    const result = await query<CompanyRow>(
      `
        SELECT
          companies.id,
          companies.name,
          companies.code,
          companies.industry,
          companies.contact_email AS "contactEmail",
          companies.logo_url AS "logoUrl",
          companies.status,
          companies.onboarding_status AS "onboardingStatus",
          companies.archived_at AS "archivedAt",
          company_admins.admin_user_id AS "assignedAdminUserId",
          COALESCE(
            ARRAY_AGG(company_modules.module_key ORDER BY company_modules.module_key)
              FILTER (WHERE company_modules.is_enabled),
            '{}'::text[]
          ) AS "enabledModules",
          companies.created_at AS "createdAt",
          companies.updated_at AS "updatedAt"
        FROM companies
        LEFT JOIN company_admins
          ON company_admins.company_id = companies.id
        LEFT JOIN company_modules
          ON company_modules.company_id = companies.id
        GROUP BY
          companies.id,
          company_admins.admin_user_id
        ORDER BY companies.created_at DESC
      `,
    );

    return result.rows
      .map((row) => mapCompanyRecord(row))
      .filter((row): row is CompanyRecord => row !== null);
  },

  async findCompanyById(companyId: string) {
    return selectCompanyRecord(defaultExecutor, "WHERE companies.id = $1", [
      companyId,
    ]);
  },

  async findCompanyByCode(code: string) {
    return selectCompanyRecord(
      defaultExecutor,
      "WHERE LOWER(companies.code) = LOWER($1)",
      [code.trim()],
    );
  },

  async listAvailableAdmins() {
    const result = await query<CompanyAdminRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email
        FROM users
        WHERE role = 'admin'
          AND is_active = TRUE
        ORDER BY full_name ASC
      `,
    );

    return result.rows.map(mapAdmin);
  },

  async listAdminsByIds(adminUserIds: readonly string[]) {
    if (adminUserIds.length === 0) {
      return new Map<string, CompanyAdminCandidate>();
    }

    const result = await query<CompanyAdminRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email
        FROM users
        WHERE role = 'admin'
          AND id = ANY($1::text[])
      `,
      [[...new Set(adminUserIds)]],
    );

    return new Map(result.rows.map((row) => [row.id, mapAdmin(row)]));
  },

  async findAdminById(adminUserId: string) {
    const result = await query<CompanyAdminRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email
        FROM users
        WHERE id = $1
          AND role = 'admin'
          AND is_active = TRUE
        LIMIT 1
      `,
      [adminUserId],
    );

    const row = result.rows[0];

    return row ? mapAdmin(row) : null;
  },

  listAvailableModules() {
    return Object.values(COMPANY_MODULE_DEFINITIONS).map(
      (definition): CompanyModuleDefinition => ({ ...definition }),
    );
  },

  async createCompany(input: {
    name: string;
    code: string;
    industry: string;
    contactEmail: string;
  }) {
    const companyId = randomUUID();

    return withTransaction(async (client) => {
      const defaultEnabledModules =
        await superadminSettingsRepository.getDefaultEnabledModules(client);

      await client.query(
        `
          INSERT INTO companies (
            id,
            name,
            code,
            industry,
            contact_email,
            status,
            onboarding_status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'active', 'pending', NOW(), NOW())
        `,
        [companyId, input.name, input.code, input.industry, input.contactEmail],
      );

      await writeCompanyModules(client, companyId, defaultEnabledModules);

      const approvalFlowId = randomUUID();

      await client.query(
        `
          INSERT INTO approval_flows (
            id,
            company_id,
            entity_type,
            name,
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, 'leave', 'Leave Approval Flow', TRUE, NOW(), NOW())
        `,
        [approvalFlowId, companyId],
      );

      await client.query(
        `
          INSERT INTO approval_steps (
            id,
            flow_id,
            step_order,
            role,
            is_required,
            created_at,
            updated_at
          ) VALUES ($1, $2, 1, 'manager', TRUE, NOW(), NOW())
        `,
        [randomUUID(), approvalFlowId],
      );

      await client.query(
        `
          INSERT INTO approval_steps (
            id,
            flow_id,
            step_order,
            role,
            is_required,
            created_at,
            updated_at
          ) VALUES ($1, $2, 2, 'hr', TRUE, NOW(), NOW())
        `,
        [randomUUID(), approvalFlowId],
      );

      await policiesRepository.ensureCompanyPolicies(companyId, client);

      return selectCompanyRecord(client, "WHERE companies.id = $1", [companyId]);
    });
  },

  async updateCompany(
    companyId: string,
    changes: {
      name: string;
      code: string;
      industry: string;
      contactEmail: string;
      onboardingStatus: CompanyOnboardingStatus;
    },
  ) {
    const result = await query<{ id: string }>(
      `
        UPDATE companies
        SET
          name = $2,
          code = $3,
          industry = $4,
          contact_email = $5,
          onboarding_status = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [
        companyId,
        changes.name,
        changes.code,
        changes.industry,
        changes.contactEmail,
        changes.onboardingStatus,
      ],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findCompanyById(companyId);
  },

  async updateCompanyStatus(companyId: string, status: CompanyStatus) {
    const result = await query<{ id: string }>(
      `
        UPDATE companies
        SET
          status = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [companyId, status],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findCompanyById(companyId);
  },

  async archiveCompany(companyId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE companies
        SET
          archived_at = NOW(),
          onboarding_status = 'suspended',
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [companyId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findCompanyById(companyId);
  },

  async restoreCompany(companyId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE companies
        SET
          archived_at = NULL,
          onboarding_status = 'active',
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [companyId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findCompanyById(companyId);
  },

  async updateCompanyLogo(companyId: string, logoUrl: string | null) {
    const result = await query<{ id: string }>(
      `
        UPDATE companies
        SET
          logo_url = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [companyId, logoUrl],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findCompanyById(companyId);
  },

  async listCompanyDeleteBlockers(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const summary = await readCompanyDependencySummary(executor, companyId);
    return summary.filter((entry) => entry.count > 0);
  },

  async listCompanyDependencySummary(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    return readCompanyDependencySummary(executor, companyId);
  },

  async deleteCompany(companyId: string) {
    const result = await query<{ id: string }>(
      `
        DELETE FROM companies
        WHERE id = $1
        RETURNING id
      `,
      [companyId],
    );

    return result.rows[0]?.id ?? null;
  },

  async assignCompanyAdmin(companyId: string, adminUserId: string) {
    return withTransaction(async (client) => {
      const previousAssignment = await client.query<{ adminUserId: string }>(
        `
          SELECT admin_user_id AS "adminUserId"
          FROM company_admins
          WHERE company_id = $1
          LIMIT 1
        `,
        [companyId],
      );

      const previousAdminUserId = previousAssignment.rows[0]?.adminUserId ?? null;

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
        [companyId, adminUserId],
      );

      await client.query(
        `
          UPDATE users
          SET
            company_id = $1,
            updated_at = NOW()
          WHERE id = $2
            AND role = 'admin'
        `,
        [companyId, adminUserId],
      );

      if (previousAdminUserId && previousAdminUserId !== adminUserId) {
        await client.query(
          `
            UPDATE users
            SET
              company_id = NULL,
              updated_at = NOW()
            WHERE id = $1
              AND role = 'admin'
              AND NOT EXISTS (
                SELECT 1
                FROM company_admins
                WHERE admin_user_id = $1
              )
          `,
          [previousAdminUserId],
        );
      }

      await client.query(
        "UPDATE companies SET updated_at = NOW() WHERE id = $1",
        [companyId],
      );

      return selectCompanyRecord(client, "WHERE companies.id = $1", [companyId]);
    });
  },

  async updateCompanyModules(
    companyId: string,
    enabledModules: CompanyRecord["enabledModules"],
  ) {
    return withTransaction(async (client) => {
      await writeCompanyModules(client, companyId, enabledModules);
      await client.query(
        "UPDATE companies SET updated_at = NOW() WHERE id = $1",
        [companyId],
      );

      return selectCompanyRecord(client, "WHERE companies.id = $1", [companyId]);
    });
  },
};
