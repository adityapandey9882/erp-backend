import type { AppRole } from "../roles/roles.types.js";

export const ERP_PERMISSION_KEYS = [
  "*",
  "users:create",
  "users:read",
  "users:update",
  "users:delete",
  "roles:create",
  "roles:read",
  "roles:update",
  "roles:assign",
  "permissions:read",
  "permissions:update",
  "approvals:read",
  "approvals:update",
  "onboarding:read",
  "onboarding:update",
  "offboarding:read",
  "offboarding:update",
  "policies:read",
  "policies:update",
  "companies:read",
  "companies:update",
  "departments:create",
  "departments:read",
  "departments:update",
  "departments:delete",
  "designations:create",
  "designations:read",
  "designations:update",
  "designations:delete",
  "attendance:read",
  "leave:approve",
  "payroll:view",
  "employees:read",
  "asset:assign",
  "documents:read",
  "notifications:read",
  "audit:read",
  "payroll:read",
  "projects:read",
  "employee:self",
] as const;

export type PermissionKey = (typeof ERP_PERMISSION_KEYS)[number];

export const ERP_PERMISSION_GROUP_KEYS = [
  "access-control",
  "organization",
  "operations",
  "self-service",
] as const;

export type PermissionGroupKey = (typeof ERP_PERMISSION_GROUP_KEYS)[number];

export type PermissionGroupDefinition = {
  key: PermissionGroupKey;
  label: string;
  description: string;
};

export type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroupKey;
};

export type PermissionCatalogEntry = PermissionDefinition & {
  id: string;
  module: string;
  action: string;
};

export const PERMISSION_GROUP_DEFINITIONS: Record<
  PermissionGroupKey,
  PermissionGroupDefinition
> = {
  "access-control": {
    key: "access-control",
    label: "Access Control",
    description:
      "Visibility into user access, role catalog, and permission assignments.",
  },
  organization: {
    key: "organization",
    label: "Organization",
    description:
      "Company, department, designation, and workforce structure visibility.",
  },
  operations: {
    key: "operations",
    label: "Operations",
    description:
      "Attendance, leave, onboarding, policies, payroll, audit, notifications, and document-oriented capabilities.",
  },
  "self-service": {
    key: "self-service",
    label: "Self Service",
    description:
      "Individual contributor access to their own work or personal workspace.",
  },
};

export const PERMISSION_DEFINITIONS: Record<PermissionKey, PermissionDefinition> = {
  "*": {
    key: "*",
    label: "All Permissions",
    description: "Unrestricted platform-wide access across every workspace.",
    group: "access-control",
  },
  "users:create": {
    key: "users:create",
    label: "Create Users",
    description: "Create new user accounts within the company scope.",
    group: "access-control",
  },
  "users:read": {
    key: "users:read",
    label: "Read Users",
    description: "View user accounts and access-related directory information.",
    group: "access-control",
  },
  "users:update": {
    key: "users:update",
    label: "Update Users",
    description: "Edit existing user accounts within the company scope.",
    group: "access-control",
  },
  "users:delete": {
    key: "users:delete",
    label: "Delete Users",
    description: "Remove or archive user accounts from the company scope.",
    group: "access-control",
  },
  "roles:create": {
    key: "roles:create",
    label: "Create Roles",
    description: "Create company-scoped roles and role overrides.",
    group: "access-control",
  },
  "roles:read": {
    key: "roles:read",
    label: "Read Roles",
    description: "View the supported role catalog and role definitions.",
    group: "access-control",
  },
  "roles:update": {
    key: "roles:update",
    label: "Update Roles",
    description: "Edit company-scoped role names and descriptions.",
    group: "access-control",
  },
  "roles:assign": {
    key: "roles:assign",
    label: "Assign Roles",
    description: "Assign permissions to roles and role overrides.",
    group: "access-control",
  },
  "permissions:read": {
    key: "permissions:read",
    label: "Read Permissions",
    description:
      "Review the current permission blueprint and permission catalog.",
    group: "access-control",
  },
  "permissions:update": {
    key: "permissions:update",
    label: "Update Permissions",
    description: "Update role-to-permission assignments for the company.",
    group: "access-control",
  },
  "approvals:read": {
    key: "approvals:read",
    label: "Read Approval Flows",
    description: "Review company-scoped approval flow definitions and step chains.",
    group: "operations",
  },
  "approvals:update": {
    key: "approvals:update",
    label: "Update Approval Flows",
    description: "Create and update company-scoped approval flow configurations.",
    group: "operations",
  },
  "onboarding:read": {
    key: "onboarding:read",
    label: "Read Onboarding",
    description: "Review company-scoped onboarding requests and progress.",
    group: "operations",
  },
  "onboarding:update": {
    key: "onboarding:update",
    label: "Update Onboarding",
    description:
      "Create, approve, reject, and complete company-scoped onboarding requests.",
    group: "operations",
  },
  "offboarding:read": {
    key: "offboarding:read",
    label: "Read Offboarding",
    description: "Review company-scoped offboarding requests and progress.",
    group: "operations",
  },
  "offboarding:update": {
    key: "offboarding:update",
    label: "Update Offboarding",
    description:
      "Create, approve, reject, and complete company-scoped offboarding requests.",
    group: "operations",
  },
  "policies:read": {
    key: "policies:read",
    label: "Read Company Policies",
    description: "Review company-scoped leave and attendance policy settings.",
    group: "operations",
  },
  "policies:update": {
    key: "policies:update",
    label: "Update Company Policies",
    description: "Edit company-scoped leave and attendance policy settings.",
    group: "operations",
  },
  "companies:read": {
    key: "companies:read",
    label: "Read Company",
    description: "View company identity, status, and tenant-level profile data.",
    group: "organization",
  },
  "companies:update": {
    key: "companies:update",
    label: "Update Company",
    description: "Edit company identity and tenant-level profile data.",
    group: "organization",
  },
  "departments:create": {
    key: "departments:create",
    label: "Create Departments",
    description: "Create new departments for the current company.",
    group: "organization",
  },
  "departments:read": {
    key: "departments:read",
    label: "Read Departments",
    description:
      "View the department structure defined for the current company.",
    group: "organization",
  },
  "departments:update": {
    key: "departments:update",
    label: "Update Departments",
    description: "Edit department metadata for the current company.",
    group: "organization",
  },
  "departments:delete": {
    key: "departments:delete",
    label: "Delete Departments",
    description: "Remove departments that are no longer needed.",
    group: "organization",
  },
  "designations:create": {
    key: "designations:create",
    label: "Create Designations",
    description: "Create new designations for the current company.",
    group: "organization",
  },
  "designations:read": {
    key: "designations:read",
    label: "Read Designations",
    description:
      "View designation titles and role labels defined for the company.",
    group: "organization",
  },
  "designations:update": {
    key: "designations:update",
    label: "Update Designations",
    description: "Edit designation titles and organization mapping.",
    group: "organization",
  },
  "designations:delete": {
    key: "designations:delete",
    label: "Delete Designations",
    description: "Remove designations that are no longer used.",
    group: "organization",
  },
  "attendance:read": {
    key: "attendance:read",
    label: "Read Attendance",
    description: "Review attendance records and attendance summaries.",
    group: "operations",
  },
  "leave:approve": {
    key: "leave:approve",
    label: "Approve Leave",
    description: "Approve or reject pending leave requests.",
    group: "operations",
  },
  "payroll:view": {
    key: "payroll:view",
    label: "View Payroll",
    description: "View payroll information and finance-facing summaries.",
    group: "operations",
  },
  "employees:read": {
    key: "employees:read",
    label: "Read Employees",
    description:
      "View employee-oriented records when employee data surfaces are available.",
    group: "organization",
  },
  "asset:assign": {
    key: "asset:assign",
    label: "Assign Assets",
    description: "Assign assets to users and track return ownership.",
    group: "operations",
  },
  "documents:read": {
    key: "documents:read",
    label: "Read Documents",
    description:
      "View document-related records and document-linked operational data.",
    group: "operations",
  },
  "notifications:read": {
    key: "notifications:read",
    label: "Read Notifications",
    description:
      "View notification-oriented operational visibility in the ERP.",
    group: "operations",
  },
  "audit:read": {
    key: "audit:read",
    label: "Read Audit",
    description: "View audit-oriented records and compliance visibility.",
    group: "operations",
  },
  "payroll:read": {
    key: "payroll:read",
    label: "Read Payroll",
    description:
      "View payroll-oriented information when payroll surfaces are enabled.",
    group: "operations",
  },
  "projects:read": {
    key: "projects:read",
    label: "Read Projects",
    description:
      "View project coordination and delivery-oriented information.",
    group: "operations",
  },
  "employee:self": {
    key: "employee:self",
    label: "Employee Self Access",
    description: "Access self-service information limited to the current user.",
    group: "self-service",
  },
};

export const ROLE_PERMISSION_BLUEPRINT: Record<AppRole, PermissionKey[]> = {
  superadmin: ["*"],
  admin: [
    "users:create",
    "users:read",
    "users:update",
    "users:delete",
    "roles:create",
    "roles:read",
    "roles:update",
    "roles:assign",
    "permissions:read",
    "permissions:update",
    "approvals:read",
    "approvals:update",
    "onboarding:read",
    "onboarding:update",
    "offboarding:read",
    "offboarding:update",
    "policies:read",
    "policies:update",
    "companies:read",
    "companies:update",
    "departments:create",
    "departments:read",
    "departments:update",
    "departments:delete",
    "designations:create",
    "designations:read",
    "designations:update",
    "designations:delete",
    "attendance:read",
    "leave:approve",
    "payroll:view",
    "projects:read",
    "asset:assign",
    "documents:read",
    "notifications:read",
    "audit:read",
  ],
  hr: [
    "attendance:read",
    "leave:approve",
    "employees:read",
    "departments:read",
    "designations:read",
    "documents:read",
    "onboarding:read",
    "onboarding:update",
    "offboarding:read",
    "offboarding:update",
  ],
  accounts: ["payroll:read", "payroll:view", "documents:read", "audit:read"],
  "project-manager": ["projects:read", "employees:read", "documents:read"],
  "team-lead": ["projects:read", "employees:read", "employee:self"],
  employee: ["employee:self", "attendance:read"],
};

export function isPermissionKey(value: string): value is PermissionKey {
  return ERP_PERMISSION_KEYS.includes(value as PermissionKey);
}

export function normalizePermissionKeys(
  permissions: readonly string[],
): PermissionKey[] {
  if (permissions.includes("*")) {
    return ["*"];
  }

  return [...new Set(permissions.filter(isPermissionKey))];
}
