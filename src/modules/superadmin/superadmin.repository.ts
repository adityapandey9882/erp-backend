import { query, withTransaction } from "../../database/index.js";
import { companiesRepository } from "../companies/companies.repository.js";
import type {
  CompanyOnboardingStatus,
  CompanyStatus,
} from "../companies/companies.types.js";
import type {
  SuperadminAdminStatus,
  SuperadminAdminView,
} from "./superadmin.types.js";

type PlatformCountsRow = {
  totalCompanies: number | string;
  activeCompanies: number | string;
  inactiveCompanies: number | string;
  companyAdminsAssigned: number | string;
  totalAdmins: number | string;
  totalUsers: number | string;
  totalAssets: number | string;
};

type AdminRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  suspendedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AdminOwnedCompanyRow = {
  id: string;
  name: string;
  code: string;
  status: CompanyStatus;
  onboardingStatus: CompanyOnboardingStatus;
  archivedAt: Date | string | null;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function getAdminStatus(
  isActive: boolean,
  suspendedAt: Date | string | null,
): SuperadminAdminStatus {
  if (!isActive && suspendedAt) {
    return "suspended";
  }

  return isActive ? "active" : "inactive";
}

function mapAdmin(row: AdminRow | undefined): SuperadminAdminView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    phone: row.phone,
    status: getAdminStatus(row.isActive, row.suspendedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    suspendedAt: row.suspendedAt ? toIsoString(row.suspendedAt) : null,
  };
}

const adminSelect = `
  SELECT
    id,
    full_name AS "fullName",
    email,
    phone,
    is_active AS "isActive",
    suspended_at AS "suspendedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM users
  WHERE role = 'admin'
`;

export const superadminRepository = {
  listCompanies() {
    return companiesRepository.listCompanies();
  },

  listAvailableAdmins() {
    return companiesRepository.listAvailableAdmins();
  },

  listAvailableModules() {
    return companiesRepository.listAvailableModules();
  },

  async getPlatformCounts() {
    const result = await query<PlatformCountsRow>(
      `
        SELECT
          (SELECT COUNT(*)::int FROM companies) AS "totalCompanies",
          (SELECT COUNT(*)::int FROM companies WHERE status = 'active') AS "activeCompanies",
          (SELECT COUNT(*)::int FROM companies WHERE status = 'inactive') AS "inactiveCompanies",
          (SELECT COUNT(*)::int FROM company_admins) AS "companyAdminsAssigned",
          (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS "totalAdmins",
          (SELECT COUNT(*)::int FROM users) AS "totalUsers",
          (SELECT COUNT(*)::int FROM company_assets) AS "totalAssets"
      `,
    );

    return {
      totalCompanies: Number(result.rows[0]?.totalCompanies ?? 0),
      activeCompanies: Number(result.rows[0]?.activeCompanies ?? 0),
      inactiveCompanies: Number(result.rows[0]?.inactiveCompanies ?? 0),
      companyAdminsAssigned: Number(result.rows[0]?.companyAdminsAssigned ?? 0),
      totalAdmins: Number(result.rows[0]?.totalAdmins ?? 0),
      totalUsers: Number(result.rows[0]?.totalUsers ?? 0),
      totalAssets: Number(result.rows[0]?.totalAssets ?? 0),
    };
  },

  async listAdmins() {
    const result = await query<AdminRow>(
      `
        ${adminSelect}
        ORDER BY full_name ASC, created_at DESC
      `,
    );

    return result.rows
      .map((row) => mapAdmin(row))
      .filter((row): row is SuperadminAdminView => row !== null);
  },

  async findAdminById(adminUserId: string) {
    const result = await query<AdminRow>(
      `
        ${adminSelect}
          AND id = $1
        LIMIT 1
      `,
      [adminUserId],
    );

    return mapAdmin(result.rows[0]);
  },

  async listAdminOwnedCompanies(adminUserId: string) {
    const result = await query<AdminOwnedCompanyRow>(
      `
        SELECT
          companies.id,
          companies.name,
          companies.code,
          companies.status,
          companies.onboarding_status AS "onboardingStatus",
          companies.archived_at AS "archivedAt"
        FROM company_admins
        INNER JOIN companies
          ON companies.id = company_admins.company_id
        WHERE company_admins.admin_user_id = $1
        ORDER BY companies.name ASC
      `,
      [adminUserId],
    );

    return result.rows.map((row) => ({
      ...row,
      archivedAt: row.archivedAt ? toIsoString(row.archivedAt) : null,
    }));
  },

  async updateAdminProfile(
    adminUserId: string,
    changes: {
      fullName: string;
      email: string;
      phone: string | null;
    },
  ) {
    const result = await query<AdminRow>(
      `
        UPDATE users
        SET
          full_name = $2,
          email = $3,
          phone = $4,
          updated_at = NOW()
        WHERE id = $1
          AND role = 'admin'
        RETURNING
          id,
          full_name AS "fullName",
          email,
          phone,
          is_active AS "isActive",
          suspended_at AS "suspendedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [adminUserId, changes.fullName, changes.email, changes.phone],
    );

    return mapAdmin(result.rows[0]);
  },

  async updateAdminAccountState(
    adminUserId: string,
    input: {
      isActive: boolean;
      suspendedAt: string | null;
    },
  ) {
    const result = await query<AdminRow>(
      `
        UPDATE users
        SET
          is_active = $2,
          suspended_at = $3,
          updated_at = NOW()
        WHERE id = $1
          AND role = 'admin'
        RETURNING
          id,
          full_name AS "fullName",
          email,
          phone,
          is_active AS "isActive",
          suspended_at AS "suspendedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [adminUserId, input.isActive, input.suspendedAt],
    );

    return mapAdmin(result.rows[0]);
  },

  async resetAdminPassword(adminUserId: string, passwordHash: string) {
    return withTransaction(async (client) => {
      const result = await client.query<AdminRow>(
        `
          UPDATE users
          SET
            password_hash = $2,
            password_version = password_version + 1,
            updated_at = NOW()
          WHERE id = $1
            AND role = 'admin'
          RETURNING
            id,
            full_name AS "fullName",
            email,
            phone,
            is_active AS "isActive",
            suspended_at AS "suspendedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [adminUserId, passwordHash],
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
        [adminUserId],
      );

      return mapAdmin(result.rows[0]);
    });
  },

  async setAdminPassword(adminUserId: string, passwordHash: string) {
    return this.resetAdminPassword(adminUserId, passwordHash);
  },

  async unassignAdminFromCompany(adminUserId: string, companyId: string) {
    return withTransaction(async (client) => {
      const deleteResult = await client.query<{ companyId: string }>(
        `
          DELETE FROM company_admins
          WHERE admin_user_id = $1
            AND company_id = $2
          RETURNING company_id AS "companyId"
        `,
        [adminUserId, companyId],
      );

      if (!deleteResult.rows[0]?.companyId) {
        return false;
      }

      const nextCompanyResult = await client.query<{ companyId: string }>(
        `
          SELECT company_id AS "companyId"
          FROM company_admins
          WHERE admin_user_id = $1
          ORDER BY updated_at DESC, company_id ASC
          LIMIT 1
        `,
        [adminUserId],
      );

      await client.query(
        `
          UPDATE users
          SET
            company_id = $2,
            updated_at = NOW()
          WHERE id = $1
            AND role = 'admin'
        `,
        [adminUserId, nextCompanyResult.rows[0]?.companyId ?? null],
      );

      await client.query(
        "UPDATE companies SET updated_at = NOW() WHERE id = $1",
        [companyId],
      );

      return true;
    });
  },

  async deleteAdmin(adminUserId: string) {
    const result = await query<{ id: string }>(
      `
        DELETE FROM users
        WHERE id = $1
          AND role = 'admin'
        RETURNING id
      `,
      [adminUserId],
    );

    return result.rows[0]?.id ?? null;
  },
};
