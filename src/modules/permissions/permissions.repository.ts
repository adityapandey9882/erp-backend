import { query } from "../../database/index.js";
import {
  PERMISSION_DEFINITIONS,
  PERMISSION_GROUP_DEFINITIONS,
  type PermissionCatalogEntry,
  type PermissionGroupKey,
  type PermissionGroupDefinition,
  type PermissionKey,
} from "./permissions.types.js";

type PermissionRow = {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function humanizeSegment(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveGroupForPermission(permissionKey: string): PermissionGroupKey {
  const permission = PERMISSION_DEFINITIONS[permissionKey as PermissionKey];

  return permission?.group ?? "operations";
}

function resolvePermissionLabel(permissionRow: PermissionRow) {
  const definition =
    PERMISSION_DEFINITIONS[permissionRow.key as PermissionKey] ?? null;

  if (definition) {
    return definition.label;
  }

  return `${humanizeSegment(permissionRow.action)} ${humanizeSegment(permissionRow.module)}`.trim();
}

function resolvePermissionDescription(permissionRow: PermissionRow) {
  const definition =
    PERMISSION_DEFINITIONS[permissionRow.key as PermissionKey] ?? null;

  if (definition) {
    return definition.description;
  }

  return `${humanizeSegment(permissionRow.action)} access for ${humanizeSegment(permissionRow.module).toLowerCase()}.`;
}

function mapPermissionRow(row: PermissionRow): PermissionCatalogEntry {
  return {
    id: row.id,
    key: row.key as PermissionKey,
    module: row.module,
    action: row.action,
    label: resolvePermissionLabel(row),
    description: resolvePermissionDescription(row),
    group: resolveGroupForPermission(row.key),
  };
}

export function buildPermissionGroups(
  permissions: readonly PermissionCatalogEntry[],
) {
  return (Object.values(PERMISSION_GROUP_DEFINITIONS) as PermissionGroupDefinition[])
    .map((groupDefinition) => {
      const groupedPermissions = permissions.filter(
        (permission) => permission.group === groupDefinition.key,
      );

      if (groupedPermissions.length === 0) {
        return null;
      }

      return {
        key: groupDefinition.key,
        label: groupDefinition.label,
        description: groupDefinition.description,
        permissionCount: groupedPermissions.length,
        permissions: groupedPermissions,
      };
    })
    .filter(
      (
        group,
      ): group is {
        key: PermissionGroupKey;
        label: string;
        description: string;
        permissionCount: number;
        permissions: PermissionCatalogEntry[];
      } => group !== null,
    );
}

export const permissionsRepository = {
  async listPermissions() {
    const result = await query<PermissionRow>(
      `
        SELECT
          id,
          key,
          module,
          action,
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM permissions
        ORDER BY module ASC, action ASC, key ASC
      `,
    );

    return result.rows.map((row) => mapPermissionRow(row));
  },

  async findPermissionIdsByKeys(permissionKeys: readonly string[]) {
    if (permissionKeys.length === 0) {
      return new Map<string, string>();
    }

    const normalizedKeys = [...new Set(permissionKeys.map((key) => key.toLowerCase()))];
    const result = await query<{ id: string; key: string }>(
      `
        SELECT id, key
        FROM permissions
        WHERE LOWER(key) = ANY($1::text[])
      `,
      [normalizedKeys],
    );

    return new Map(
      result.rows.map((row) => [row.key.toLowerCase(), row.id] as const),
    );
  },

  async findPermissionByKey(permissionKey: string) {
    const result = await query<PermissionRow>(
      `
        SELECT
          id,
          key,
          module,
          action,
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM permissions
        WHERE LOWER(key) = LOWER($1)
        LIMIT 1
      `,
      [permissionKey],
    );

    return result.rows[0] ? mapPermissionRow(result.rows[0]) : null;
  },
};
