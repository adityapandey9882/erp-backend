import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";
import {
  COMPANY_MODULE_DEFINITIONS,
  normalizeCompanyModules,
  type CompanyModuleKey,
} from "../../modules/companies/companies.types.js";
import type { AppRole } from "../../modules/roles/roles.types.js";

type RoleScopedModuleRules = Partial<Record<AppRole, readonly CompanyModuleKey[]>>;

function formatModuleList(moduleKeys: readonly CompanyModuleKey[]) {
  return moduleKeys
    .map((moduleKey) => COMPANY_MODULE_DEFINITIONS[moduleKey].label)
    .join(" / ");
}

export function roleScopedModuleAccessMiddleware(rules: RoleScopedModuleRules) {
  const normalizedRules = Object.fromEntries(
    Object.entries(rules).map(([role, modules]) => [
      role,
      normalizeCompanyModules(modules ?? []),
    ]),
  ) as Partial<Record<AppRole, CompanyModuleKey[]>>;

  return (request: Request, response: Response, next: NextFunction) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.auth;

    if (!user) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    if (user.role === "superadmin") {
      next();
      return;
    }

    const requiredModules = normalizedRules[user.role] ?? [];

    if (requiredModules.length === 0) {
      next();
      return;
    }

    if (!user.companyId) {
      response.status(403).json({
        message: "Your account is not assigned to a company context.",
      });
      return;
    }

    const enabledModules = new Set(user.enabledModules);
    const hasAccess = requiredModules.every((moduleKey) =>
      enabledModules.has(moduleKey),
    );

    if (hasAccess) {
      next();
      return;
    }

    response.status(403).json({
      message: `${formatModuleList(requiredModules)} is disabled for your company.`,
    });
  };
}
