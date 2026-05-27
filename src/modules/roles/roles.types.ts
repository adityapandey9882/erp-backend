export const ERP_ROLES = [
  "superadmin",
  "admin",
  "hr",
  "accounts",
  "project-manager",
  "team-lead",
  "employee",
] as const;

export type AppRole = (typeof ERP_ROLES)[number];

export type RoleDefinition = {
  role: AppRole;
  label: string;
  dashboardPath: string;
  description: string;
};

export type RoleScope = "system" | "company";

export type RoleCatalogEntry = {
  id: string;
  code: string;
  name: string;
  description: string;
  companyId: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoleCatalogSummary = RoleCatalogEntry & {
  scope: RoleScope;
  editable: boolean;
  permissionCount: number;
  userCount: number;
  activeUserCount: number;
  inactiveUserCount: number;
  effective: boolean;
  overridesSystemRole: boolean;
};

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  superadmin: {
    role: "superadmin",
    label: "Superadmin",
    dashboardPath: "/dashboard/superadmin",
    description: "Platform-wide governance and global ERP oversight.",
  },
  admin: {
    role: "admin",
    label: "Admin",
    dashboardPath: "/dashboard/admin",
    description: "Operational setup, administration, and access coordination.",
  },
  hr: {
    role: "hr",
    label: "HR",
    dashboardPath: "/dashboard/hr",
    description: "People operations and workforce administration.",
  },
  accounts: {
    role: "accounts",
    label: "Accounts",
    dashboardPath: "/dashboard/accounts",
    description: "Finance coordination and accounting operations.",
  },
  "project-manager": {
    role: "project-manager",
    label: "Project Manager",
    dashboardPath: "/dashboard/project-manager",
    description: "Project delivery planning and coordination.",
  },
  "team-lead": {
    role: "team-lead",
    label: "Team Lead",
    dashboardPath: "/dashboard/team-lead",
    description: "Execution oversight and team-level coordination.",
  },
  employee: {
    role: "employee",
    label: "Employee",
    dashboardPath: "/dashboard/employee",
    description: "Employee self-service and assigned work context.",
  },
};

export function isAppRole(value: string): value is AppRole {
  return ERP_ROLES.includes(value as AppRole);
}

export function getDashboardPathForRole(role: AppRole) {
  return ROLE_DEFINITIONS[role].dashboardPath;
}

export function normalizeRoleCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
