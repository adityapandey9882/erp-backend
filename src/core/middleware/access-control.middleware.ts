import type { RequestHandler } from "express";
import type { CompanyModuleKey } from "../../modules/companies/companies.types.js";
import type { PermissionKey } from "../../modules/permissions/permissions.types.js";
import type { AppRole } from "../../modules/roles/roles.types.js";
import { authMiddleware } from "./auth.middleware.js";
import { maintenanceModeMiddleware } from "./maintenance-mode.middleware.js";
import { moduleAccessMiddleware } from "./module-access.middleware.js";
import { permissionMiddleware } from "./permission.middleware.js";
import { roleMiddleware } from "./role.middleware.js";

type ProtectedRouteOptions = {
  roles?: readonly AppRole[];
  permissions?: readonly PermissionKey[];
  modules?: readonly CompanyModuleKey[];
  permissionMatch?: "all" | "any";
  moduleMatch?: "all" | "any";
};

export function protectedRoute(
  options: ProtectedRouteOptions = {},
): RequestHandler[] {
  const middleware: RequestHandler[] = [authMiddleware, maintenanceModeMiddleware];

  if (options.roles?.length) {
    middleware.push(roleMiddleware(options.roles));
  }

  if (options.permissions?.length) {
    middleware.push(
      permissionMiddleware(options.permissions, {
        match: options.permissionMatch,
      }),
    );
  }

  if (options.modules?.length) {
    middleware.push(
      moduleAccessMiddleware(options.modules, {
        match: options.moduleMatch,
      }),
    );
  }

  return middleware;
}
