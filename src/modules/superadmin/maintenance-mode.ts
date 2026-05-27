import type { AuthRole } from "../auth/auth.types.js";
import type {
  MaintenanceScope,
  MaintenanceTargetRole,
  SuperadminSettingsOperations,
} from "./superadmin.types.js";

export const MAINTENANCE_TARGET_ROLES: readonly MaintenanceTargetRole[] = [
  "admin",
  "hr",
  "accounts",
  "project-manager",
  "team-lead",
  "employee",
] as const;

const maintenanceTargetRoleSet = new Set<string>(MAINTENANCE_TARGET_ROLES);

export function isMaintenanceScope(value: string): value is MaintenanceScope {
  return value === "all" || value === "selected";
}

export function isMaintenanceTargetRole(
  value: string,
): value is MaintenanceTargetRole {
  return maintenanceTargetRoleSet.has(value);
}

export function normalizeMaintenanceTargets(
  values: readonly string[],
): MaintenanceTargetRole[] {
  const uniqueTargets = new Set<MaintenanceTargetRole>();

  for (const value of values) {
    if (isMaintenanceTargetRole(value)) {
      uniqueTargets.add(value);
    }
  }

  return MAINTENANCE_TARGET_ROLES.filter((role) => uniqueTargets.has(role));
}

export function isMaintenanceActiveForRole(
  operations: Pick<
    SuperadminSettingsOperations,
    "maintenanceMode" | "maintenanceScope" | "maintenanceTargets"
  >,
  role: AuthRole,
) {
  if (!operations.maintenanceMode || role === "superadmin") {
    return false;
  }

  if (operations.maintenanceScope === "all") {
    return true;
  }

  return operations.maintenanceTargets.includes(role as MaintenanceTargetRole);
}
