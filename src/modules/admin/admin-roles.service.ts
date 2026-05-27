import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import {
  buildPermissionGroups,
  permissionsRepository,
} from "../permissions/permissions.repository.js";
import type { PermissionCatalogEntry } from "../permissions/permissions.types.js";
import {
  ROLE_DEFINITIONS,
  isAppRole,
  type AppRole,
} from "../roles/roles.types.js";
import { rolesRepository } from "../roles/roles.repository.js";
import type {
  AdminPermissionGroupSummary,
  AdminRoleAccessSummary,
  AdminRoleMutationResponse,
  AdminRolePermissionsResponse,
  AdminRolesServiceResult,
  AdminRolesWorkspaceResponse,
} from "./admin-roles.types.js";

type RoleVisibilityBlueprint = {
  modules: readonly string[];
  match: "all" | "any";
  note: string;
};

const companyRelevantRoles = [
  "admin",
  "hr",
  "accounts",
  "project-manager",
  "team-lead",
  "employee",
] as const satisfies readonly AppRole[];

const roleVisibilityBlueprints: Record<AppRole, RoleVisibilityBlueprint> = {
  superadmin: {
    modules: [],
    match: "all",
    note: "The superadmin workspace is always available.",
  },
  admin: {
    modules: ["admin"],
    match: "all",
    note: "The company-admin workspace requires the Admin module to remain enabled.",
  },
  hr: {
    modules: ["hr"],
    match: "all",
    note: "The HR dashboard is available only when the HR module is enabled.",
  },
  accounts: {
    modules: ["accounts", "payroll"],
    match: "any",
    note: "The current accounts dashboard becomes available when either Accounts or Payroll is enabled because the system shares one finance surface.",
  },
  "project-manager": {
    modules: ["projects"],
    match: "all",
    note: "Project manager access is tied to the Projects module.",
  },
  "team-lead": {
    modules: ["team-lead"],
    match: "all",
    note: "Team lead access is tied to the Team Lead module.",
  },
  employee: {
    modules: ["employee-self"],
    match: "all",
    note: "Employee dashboard visibility depends on the Employee Self-Service module.",
  },
};

type WorkspaceRoleSnapshot = {
  systemRoles: AdminRoleAccessSummary[];
  companyRoles: AdminRoleAccessSummary[];
  roles: AdminRoleAccessSummary[];
  permissions: PermissionCatalogEntry[];
  permissionGroups: AdminPermissionGroupSummary[];
  summary: AdminRolesWorkspaceResponse["summary"];
};

function ok<T>(data: T): AdminRolesServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): AdminRolesServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function resolveDashboardPath(code: string) {
  return isAppRole(code) ? ROLE_DEFINITIONS[code].dashboardPath : null;
}

function hasModuleAccess(
  enabledModules: readonly string[],
  blueprint: RoleVisibilityBlueprint,
) {
  const enabledModuleSet = new Set(enabledModules);

  if (blueprint.modules.length === 0) {
    return true;
  }

  return blueprint.match === "any"
    ? blueprint.modules.some((moduleKey) => enabledModuleSet.has(moduleKey))
    : blueprint.modules.every((moduleKey) => enabledModuleSet.has(moduleKey));
}

function countRolesUsingPermissionGroup(
  roles: readonly AdminRoleAccessSummary[],
  groupKey: string,
) {
  return roles.filter((role) =>
    role.permissions.some((permission) => permission.group === groupKey),
  ).length;
}

function buildPermissionGroupsForRoles(
  permissions: readonly PermissionCatalogEntry[],
  roles: readonly AdminRoleAccessSummary[],
) {
  return buildPermissionGroups(permissions).map((group) => ({
    ...group,
    roleCount: countRolesUsingPermissionGroup(roles, group.key),
  }));
}

function buildDashboardSummary(
  enabledModules: readonly string[],
  roles: readonly AdminRoleAccessSummary[],
): AdminRolesWorkspaceResponse["summary"] {
  const dashboardRoles = companyRelevantRoles
    .map((roleCode) => roles.find((role) => role.code === roleCode))
    .filter((role): role is AdminRoleAccessSummary => Boolean(role));

  const visibleDashboards = dashboardRoles.filter((role) =>
    hasModuleAccess(enabledModules, roleVisibilityBlueprints[role.code as AppRole]),
  ).length;

  return {
    totalRoles: roles.length,
    systemRoles: roles.filter((role) => role.scope === "system").length,
    companyRoles: roles.filter((role) => role.scope === "company").length,
    overriddenRoles: roles.filter((role) => role.overridesSystemRole).length,
    rolesInUse: roles.filter((role) => role.userCount > 0).length,
    permissionGroups: 0,
    visibleDashboards,
    restrictedDashboards: dashboardRoles.length - visibleDashboards,
  };
}

async function buildWorkspaceSnapshot(
  user: AuthenticatedUser,
): Promise<WorkspaceRoleSnapshot | null> {
  if (!user.companyId) {
    return null;
  }

  const [company, roleCollections, permissions] = await Promise.all([
    companiesService.getCompanyView(user.companyId),
    rolesRepository.listWorkspaceRoles(user.companyId),
    permissionsRepository.listPermissions(),
  ]);

  if (!company) {
    return null;
  }

  const combinedRoleList = [
    ...roleCollections.systemRoles,
    ...roleCollections.companyRoles,
  ];

  const rolePermissionMap = await rolesRepository.listRolePermissionEntries(
    combinedRoleList.map((role) => role.id),
  );

  const systemRoleCodeSet = new Set(
    roleCollections.systemRoles.map((role) => role.code.toLowerCase()),
  );

  const decoratedSystemRoles = roleCollections.systemRoles.map<AdminRoleAccessSummary>(
    (role) => ({
      ...role,
      dashboardPath: resolveDashboardPath(role.code),
      permissions: rolePermissionMap.get(role.id) ?? [],
    }),
  );

  const decoratedCompanyRoles = roleCollections.companyRoles.map<AdminRoleAccessSummary>(
    (role) => ({
      ...role,
      dashboardPath: resolveDashboardPath(role.code),
      permissions: rolePermissionMap.get(role.id) ?? [],
    }),
  );

  const decoratedCompanyRoleByCode = new Map(
    decoratedCompanyRoles.map((role) => [role.code.toLowerCase(), role]),
  );

  const effectiveRoles: AdminRoleAccessSummary[] = [
    ...decoratedSystemRoles
      .map((role) => decoratedCompanyRoleByCode.get(role.code.toLowerCase()) ?? role)
      .filter(
        (role, index, self) =>
          self.findIndex((entry) => entry.code.toLowerCase() === role.code.toLowerCase()) ===
          index,
      ),
    ...decoratedCompanyRoles.filter(
      (role) => !systemRoleCodeSet.has(role.code.toLowerCase()),
    ),
  ];

  const permissionGroups = buildPermissionGroupsForRoles(permissions, effectiveRoles);
  const summary = buildDashboardSummary(company.enabledModules, effectiveRoles);

  return {
    systemRoles: decoratedSystemRoles.map((role) => ({
      ...role,
      effective:
        decoratedCompanyRoleByCode.get(role.code.toLowerCase()) === undefined
          ? role.effective
          : false,
    })),
    companyRoles: decoratedCompanyRoles,
    roles: effectiveRoles,
    permissions,
    permissionGroups,
    summary: {
      ...summary,
      permissionGroups: permissionGroups.length,
    },
  };
}

async function buildWorkspaceResponse(
  user: AuthenticatedUser,
): Promise<AdminRolesWorkspaceResponse | null> {
  if (!user.companyId) {
    return null;
  }

  const snapshot = await buildWorkspaceSnapshot(user);

  if (!snapshot) {
    return null;
  }

  const company = await companiesService.getCompanyView(user.companyId);

  if (!company) {
    return null;
  }

  const moduleDefinitions = companiesService.listAvailableModules();
  const enabledModules = moduleDefinitions.filter((moduleDefinition) =>
    company.enabledModules.includes(moduleDefinition.key),
  );
  const disabledModules = moduleDefinitions.filter(
    (moduleDefinition) => !company.enabledModules.includes(moduleDefinition.key),
  );

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: {
      ...snapshot.summary,
      permissionGroups: snapshot.permissionGroups.length,
    },
    controls: {
      permissionModel: "db-backed",
      roleCatalogEditable: true,
      permissionBlueprintEditable: false,
      note: "Roles and permissions are now stored in the database. System roles remain locked, while company-scoped roles can be created and adjusted per tenant.",
    },
    roles: snapshot.roles,
    systemRoles: snapshot.systemRoles,
    companyRoles: snapshot.companyRoles,
    permissions: snapshot.permissions,
    permissionGroups: snapshot.permissionGroups,
    modules: {
      enabled: enabledModules,
      disabled: disabledModules,
    },
  };
}

async function resolveRoleResponse(
  user: AuthenticatedUser,
  roleId: string,
) {
  const snapshot = await buildWorkspaceSnapshot(user);

  if (!snapshot) {
    return null;
  }

  return snapshot.roles.find((role) => role.id === roleId) ?? null;
}

export const adminRolesService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminRolesServiceResult<AdminRolesWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const workspace = await buildWorkspaceResponse(user);

    if (!workspace) {
      return fail(404, "Company not found.");
    }

    return ok(workspace);
  },

  async createRole(
    user: AuthenticatedUser,
    input: { code: string; name: string; description: string },
  ): Promise<AdminRolesServiceResult<AdminRoleMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    let role: Awaited<ReturnType<typeof rolesRepository.createCompanyRole>> = null;

    try {
      role = await rolesRepository.createCompanyRole(user.companyId, input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A role with this code already exists for the company.");
      }

      throw error;
    }

    if (!role) {
      return fail(409, "Unable to create the role.");
    }

    const response = await resolveRoleResponse(user, role.id);

    if (!response) {
      return fail(404, "Role not found.");
    }

    void auditService.recordAction(user, {
      action: "role.created",
      entityType: "role",
      entityId: response.id,
      metadata: {
        code: response.code,
        name: response.name,
        description: response.description,
        scope: response.scope,
      },
    });

    return ok({
      message: "Role created successfully.",
      role: response,
    });
  },

  async updateRole(
    user: AuthenticatedUser,
    roleId: string,
    input: { name: string; description: string },
  ): Promise<AdminRolesServiceResult<AdminRoleMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const role = await rolesRepository.findRoleById(roleId);

    if (!role) {
      return fail(404, "Role not found.");
    }

    if (role.companyId !== user.companyId || role.isSystem) {
      return fail(403, "System roles cannot be edited from the company workspace.");
    }

    const updatedRole = await rolesRepository.updateCompanyRole(user.companyId, roleId, input);

    if (!updatedRole) {
      return fail(404, "Role not found.");
    }

    const response = await resolveRoleResponse(user, updatedRole.id);

    if (!response) {
      return fail(404, "Role not found.");
    }

    void auditService.recordAction(user, {
      action: "role.updated",
      entityType: "role",
      entityId: response.id,
      metadata: {
        code: response.code,
        name: response.name,
        description: response.description,
        scope: response.scope,
      },
    });

    return ok({
      message: "Role updated successfully.",
      role: response,
    });
  },

  async updateRolePermissions(
    user: AuthenticatedUser,
    roleId: string,
    permissionKeys: readonly string[],
  ): Promise<AdminRolesServiceResult<AdminRolePermissionsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const role = await rolesRepository.findRoleById(roleId);

    if (!role) {
      return fail(404, "Role not found.");
    }

    if (role.companyId !== user.companyId || role.isSystem) {
      return fail(403, "System roles cannot be edited from the company workspace.");
    }

    const updatedRole = await rolesRepository.replaceRolePermissions(
      user.companyId,
      roleId,
      permissionKeys,
    );

    if (!updatedRole) {
      return fail(409, "One or more permissions could not be assigned.");
    }

    const response = await resolveRoleResponse(user, updatedRole.id);

    if (!response) {
      return fail(404, "Role not found.");
    }

    void auditService.recordAction(user, {
      action: "role.permissions.updated",
      entityType: "role",
      entityId: response.id,
      metadata: {
        code: response.code,
        permissionKeys: permissionKeys.filter((permissionKey) => permissionKey.trim()),
      },
    });

    return ok({
      message: "Role permissions updated successfully.",
      role: response,
    });
  },
};
