import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";
import type { AppRole } from "../../modules/roles/roles.types.js";

export function roleMiddleware(roles: readonly AppRole[]) {
  const allowedRoles = new Set(roles);

  return (request: Request, response: Response, next: NextFunction) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.auth;

    if (!user) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    if (allowedRoles.size === 0) {
      next();
      return;
    }

    if (user.role === "superadmin" || allowedRoles.has(user.role)) {
      next();
      return;
    }

    response.status(403).json({
      message: "You do not have access to this role scope.",
    });
  };
}
