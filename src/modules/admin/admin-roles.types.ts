import type {
  CompanyModuleDefinition,
  CompanyStatus,
} from "../companies/companies.types.js";
import type {
  PermissionCatalogEntry,
  PermissionGroupKey,
} from "../permissions/permissions.types.js";
import type {
  RoleCatalogSummary,
} from "../roles/roles.types.js";

export type AdminPermissionGroupSummary = {
  key: PermissionGroupKey;
  label: string;
  description: string;
  permissionCount: number;
  roleCount: number;
  permissions: PermissionCatalogEntry[];
};

export type AdminRoleAccessSummary = RoleCatalogSummary & {
  dashboardPath: string | null;
  permissions: PermissionCatalogEntry[];
};

export type AdminRolesWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalRoles: number;
    systemRoles: number;
    companyRoles: number;
    overriddenRoles: number;
    rolesInUse: number;
    permissionGroups: number;
    visibleDashboards: number;
    restrictedDashboards: number;
  };
  controls: {
    permissionModel: "db-backed";
    roleCatalogEditable: true;
    permissionBlueprintEditable: false;
    note: string;
  };
  roles: AdminRoleAccessSummary[];
  systemRoles: AdminRoleAccessSummary[];
  companyRoles: AdminRoleAccessSummary[];
  permissions: PermissionCatalogEntry[];
  permissionGroups: AdminPermissionGroupSummary[];
  modules: {
    enabled: CompanyModuleDefinition[];
    disabled: CompanyModuleDefinition[];
  };
};

export type AdminRoleMutationResponse = {
  message: string;
  role: AdminRoleAccessSummary;
};

export type AdminRolePermissionsResponse = {
  message: string;
  role: AdminRoleAccessSummary;
};

export type AdminRolesServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AdminRolesServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type AdminRolesServiceResult<T> =
  | AdminRolesServiceSuccess<T>
  | AdminRolesServiceFailure;
