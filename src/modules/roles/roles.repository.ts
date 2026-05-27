import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../../database/index.js";
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_BLUEPRINT,
  normalizePermissionKeys,
  type PermissionCatalogEntry,
  type PermissionKey,
} from "../permissions/permissions.types.js";
import { permissionsRepository } from "../permissions/permissions.repository.js";
import {
  ROLE_DEFINITIONS,
  normalizeRoleCode,
  type AppRole,
  type RoleCatalogEntry,
  type RoleCatalogSummary,
} from "./roles.types.js";

type RoleRow = {
  id: string;
  companyId: string | null;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type RolePermissionRow = {
  roleId: string;
  permissionId: string;
  permissionKey: string;
  permissionModule: string;
  permissionAction: string;
  permissionDescription: string;
};

type RoleUsageRow = {
  code: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
};

type CreateRoleInput = {
  code: string;
  name: string;
  description: string;
};

type UpdateRoleInput = {
  name: string;
  description: string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapPermissionRow(row: RolePermissionRow): PermissionCatalogEntry {
  const permissionDefinition =
    PERMISSION_DEFINITIONS[row.permissionKey as PermissionKey] ?? null;

  return {
    id: row.permissionId,
    key: row.permissionKey as PermissionKey,
    module: row.permissionModule,
    action: row.permissionAction,
    label:
      permissionDefinition?.label ??
      `${row.permissionAction} ${row.permissionModule}`.trim(),
    description:
      permissionDefinition?.description ??
      row.permissionDescription ??
      `${row.permissionAction} access for ${row.permissionModule}.`,
    group: permissionDefinition?.group ?? "operations",
  };
}

function mapRoleRow(row: RoleRow): RoleCatalogEntry {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function fetchRolePermissionEntries(roleIds: readonly string[]) {
  if (roleIds.length === 0) {
    return new Map<string, PermissionCatalogEntry[]>();
  }

  const result = await query<RolePermissionRow>(
    `
      SELECT
        role_permissions.role_id AS "roleId",
        role_permissions.permission_id AS "permissionId",
        permissions.key AS "permissionKey",
        permissions.module AS "permissionModule",
        permissions.action AS "permissionAction",
        permissions.description AS "permissionDescription"
      FROM role_permissions
      INNER JOIN permissions
        ON permissions.id = role_permissions.permission_id
      WHERE role_permissions.role_id = ANY($1::text[])
      ORDER BY permissions.module ASC, permissions.action ASC, permissions.key ASC
    `,
    [roleIds],
  );

  const entriesByRoleId = new Map<string, PermissionCatalogEntry[]>();

  for (const row of result.rows) {
    const permissions = entriesByRoleId.get(row.roleId) ?? [];
    permissions.push(mapPermissionRow(row));
    entriesByRoleId.set(row.roleId, permissions);
  }

  return entriesByRoleId;
}

async function listRoleUsage(companyId: string) {
  const result = await query<RoleUsageRow>(
    `
      SELECT
        users.role AS code,
        COUNT(*)::int AS "totalUsers",
        COUNT(*) FILTER (WHERE users.is_active = TRUE)::int AS "activeUsers",
        COUNT(*) FILTER (WHERE users.is_active = FALSE)::int AS "inactiveUsers"
      FROM users
      LEFT JOIN LATERAL (
        SELECT company_id
        FROM company_admins
        WHERE admin_user_id = users.id
        ORDER BY updated_at DESC, created_at DESC, company_id ASC
        LIMIT 1
      ) AS admin_company ON users.role = 'admin'
      WHERE (
        CASE
          WHEN users.role = 'admin' THEN admin_company.company_id
          ELSE users.company_id
        END
      ) = $1
      GROUP BY users.role
      ORDER BY users.role ASC
    `,
    [companyId],
  );

  return new Map(result.rows.map((row) => [row.code.toLowerCase(), row]));
}

function mapRoleSummary(
  row: RoleRow,
  permissionCount: number,
  roleUsage: Map<string, RoleUsageRow>,
  effective: boolean,
  overridesSystemRole: boolean,
): RoleCatalogSummary {
  const usage = roleUsage.get(row.code.toLowerCase());

  return {
    ...mapRoleRow(row),
    scope: row.isSystem ? "system" : "company",
    editable: !row.isSystem,
    permissionCount,
    userCount: usage?.totalUsers ?? 0,
    activeUserCount: usage?.activeUsers ?? 0,
    inactiveUserCount: usage?.inactiveUsers ?? 0,
    effective,
    overridesSystemRole,
  };
}

async function fetchRolePermissionsMap(roleRows: readonly RoleRow[]) {
  return fetchRolePermissionEntries(roleRows.map((role) => role.id));
}

async function listSystemRoleRows() {
  const result = await query<RoleRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        code,
        name,
        description,
        is_system AS "isSystem",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM roles
      WHERE company_id IS NULL
        AND is_system = TRUE
      ORDER BY created_at ASC, code ASC
    `,
  );

  return result.rows.map((row) => mapRoleRow(row));
}

async function listCompanyRoleRows(companyId: string) {
  const result = await query<RoleRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        code,
        name,
        description,
        is_system AS "isSystem",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM roles
      WHERE company_id = $1
      ORDER BY created_at ASC, code ASC
    `,
    [companyId],
  );

  return result.rows.map((row) => mapRoleRow(row));
}

export const rolesRepository = {
  async listPermissions() {
    return permissionsRepository.listPermissions();
  },

  async listSystemRoles() {
    return listSystemRoleRows();
  },

  async listCompanyRoles(companyId: string) {
    return listCompanyRoleRows(companyId);
  },

  async listWorkspaceRoles(companyId: string) {
    const [systemRoles, companyRoles, roleUsage] = await Promise.all([
      listSystemRoleRows(),
      listCompanyRoleRows(companyId),
      listRoleUsage(companyId),
    ]);

    const effectiveCompanyRoleCodes = new Set(
      companyRoles.map((role) => role.code.toLowerCase()),
    );

    const [systemRolePermissions, companyRolePermissions] = await Promise.all([
      fetchRolePermissionsMap(systemRoles),
      fetchRolePermissionsMap(companyRoles),
    ]);

    const systemRoleSummaries = systemRoles.map<RoleCatalogSummary>((role) =>
      mapRoleSummary(
        role,
        systemRolePermissions.get(role.id)?.length ?? 0,
        roleUsage,
        !effectiveCompanyRoleCodes.has(role.code.toLowerCase()),
        effectiveCompanyRoleCodes.has(role.code.toLowerCase()),
      ),
    );

    const companyRoleSummaries = companyRoles.map<RoleCatalogSummary>((role) =>
      mapRoleSummary(
        role,
        companyRolePermissions.get(role.id)?.length ?? 0,
        roleUsage,
        true,
        ROLE_DEFINITIONS[role.code as AppRole] !== undefined,
      ),
    );

    return {
      systemRoles: systemRoleSummaries,
      companyRoles: companyRoleSummaries,
    };
  },

  async findRoleById(roleId: string) {
    const result = await query<RoleRow>(
      `
        SELECT
          id,
          company_id AS "companyId",
          code,
          name,
          description,
          is_system AS "isSystem",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM roles
        WHERE id = $1
        LIMIT 1
      `,
      [roleId],
    );

    return result.rows[0] ? mapRoleRow(result.rows[0]) : null;
  },

  async findEffectiveRoleByCode(companyId: string | null, code: string) {
    const result = await query<RoleRow>(
      `
        SELECT
          id,
          company_id AS "companyId",
          code,
          name,
          description,
          is_system AS "isSystem",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM roles
        WHERE LOWER(code) = LOWER($1)
          AND (
            company_id = $2
            OR (company_id IS NULL AND is_system = TRUE)
          )
        ORDER BY
          CASE WHEN company_id = $2 THEN 0 ELSE 1 END,
          is_system DESC,
          created_at ASC
        LIMIT 1
      `,
      [code, companyId],
    );

    return result.rows[0] ? mapRoleRow(result.rows[0]) : null;
  },

  async getPermissionsForRoleId(roleId: string) {
    const entriesByRoleId = await fetchRolePermissionEntries([roleId]);
    return entriesByRoleId.get(roleId) ?? [];
  },

  async getPermissionsForRoleCode(companyId: string | null, code: string) {
    if (normalizeRoleCode(code) === "superadmin") {
      return ["*"] as PermissionKey[];
    }

    const role = await this.findEffectiveRoleByCode(companyId, code);

    if (!role) {
      const roleKey = code.toLowerCase() as AppRole;

      if (ROLE_PERMISSION_BLUEPRINT[roleKey as AppRole]) {
        return normalizePermissionKeys(ROLE_PERMISSION_BLUEPRINT[roleKey as AppRole]);
      }

      return [];
    }

    const permissions = await this.getPermissionsForRoleId(role.id);

    if (permissions.length > 0) {
      return normalizePermissionKeys(permissions.map((permission) => permission.key));
    }

    const systemKey = role.code.toLowerCase() as AppRole;

    if (ROLE_PERMISSION_BLUEPRINT[systemKey]) {
      return normalizePermissionKeys(ROLE_PERMISSION_BLUEPRINT[systemKey]);
    }

    return [];
  },

  async createCompanyRole(
    companyId: string,
    input: CreateRoleInput,
  ): Promise<RoleCatalogEntry | null> {
    const normalizedCode = normalizeRoleCode(input.code);
    const normalizedName = input.name.trim();
    const normalizedDescription = input.description.trim();

    if (!normalizedCode || normalizedCode === "superadmin") {
      return null;
    }

    const result = await query<RoleRow>(
      `
        INSERT INTO roles (
          id,
          company_id,
          code,
          name,
          description,
          is_system,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())
        RETURNING
          id,
          company_id AS "companyId",
          code,
          name,
          description,
          is_system AS "isSystem",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [randomUUID(), companyId, normalizedCode, normalizedName, normalizedDescription],
    );

    return result.rows[0] ? mapRoleRow(result.rows[0]) : null;
  },

  async updateCompanyRole(
    companyId: string,
    roleId: string,
    input: UpdateRoleInput,
  ): Promise<RoleCatalogEntry | null> {
    const result = await query<RoleRow>(
      `
        UPDATE roles
        SET
          name = $3,
          description = $4,
          updated_at = NOW()
        WHERE id = $1
          AND company_id = $2
          AND is_system = FALSE
        RETURNING
          id,
          company_id AS "companyId",
          code,
          name,
          description,
          is_system AS "isSystem",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [roleId, companyId, input.name.trim(), input.description.trim()],
    );

    return result.rows[0] ? mapRoleRow(result.rows[0]) : null;
  },

  async replaceRolePermissions(
    companyId: string,
    roleId: string,
    permissionKeys: readonly string[],
  ): Promise<RoleCatalogEntry | null> {
    const normalizedKeys = normalizePermissionKeys(permissionKeys);
    const permissionIdMap = await permissionsRepository.findPermissionIdsByKeys(
      normalizedKeys,
    );

    if (normalizedKeys.some((key) => !permissionIdMap.has(key.toLowerCase()))) {
      return null;
    }

    return withTransaction(async (client) => {
      const roleResult = await client.query<RoleRow>(
        `
          SELECT
            id,
            company_id AS "companyId",
            code,
            name,
            description,
            is_system AS "isSystem",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM roles
          WHERE id = $1
            AND company_id = $2
            AND is_system = FALSE
          LIMIT 1
        `,
        [roleId, companyId],
      );

      const role = roleResult.rows[0];

      if (!role) {
        return null;
      }

      await client.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
        `,
        [role.id],
      );

      for (const permissionKey of normalizedKeys) {
        const permissionId = permissionIdMap.get(permissionKey.toLowerCase());

        if (!permissionId) {
          continue;
        }

        await client.query(
          `
            INSERT INTO role_permissions (
              id,
              role_id,
              permission_id,
              created_at
            ) VALUES ($1, $2, $3, NOW())
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [randomUUID(), role.id, permissionId],
        );
      }

      return mapRoleRow(role);
    });
  },

  async getRolePermissionCatalog(roleId: string) {
    return fetchRolePermissionEntries([roleId]).then((entriesByRoleId) =>
      entriesByRoleId.get(roleId) ?? [],
    );
  },

  async listRolePermissionEntries(roleIds: readonly string[]) {
    return fetchRolePermissionEntries(roleIds);
  },
};
