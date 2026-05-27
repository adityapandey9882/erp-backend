import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";
import {
  normalizePermissionKeys,
  type PermissionKey,
} from "../../modules/permissions/permissions.types.js";

type PermissionMatchStrategy = "all" | "any";

type PermissionMiddlewareOptions = {
  match?: PermissionMatchStrategy;
};

export function permissionMiddleware(
  permissions: readonly PermissionKey[],
  options: PermissionMiddlewareOptions = {},
) {
  const requiredPermissions = normalizePermissionKeys(permissions);
  const match = options.match ?? "all";

  return (request: Request, response: Response, next: NextFunction) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.auth;

    if (!user) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    if (requiredPermissions.length === 0) {
      next();
      return;
    }

    const grantedPermissions = new Set(user.permissions);
    const hasPermission =
      user.role === "superadmin" ||
      grantedPermissions.has("*") ||
      (match === "any"
        ? requiredPermissions.some((permission) =>
            grantedPermissions.has(permission),
          )
        : requiredPermissions.every((permission) =>
            grantedPermissions.has(permission),
          ));

    if (hasPermission) {
      next();
      return;
    }

    response.status(403).json({
      message: "You do not have the required permission for this resource.",
    });
  };
}
