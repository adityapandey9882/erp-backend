import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";
import {
  COMPANY_MODULE_DEFINITIONS,
  normalizeCompanyModules,
  type CompanyModuleKey,
} from "../../modules/companies/companies.types.js";

type ModuleMatchStrategy = "all" | "any";

type ModuleAccessMiddlewareOptions = {
  match?: ModuleMatchStrategy;
};

function formatModuleList(moduleKeys: readonly CompanyModuleKey[]) {
  return moduleKeys
    .map((moduleKey) => COMPANY_MODULE_DEFINITIONS[moduleKey].label)
    .join(" / ");
}

export function moduleAccessMiddleware(
  modules: readonly CompanyModuleKey[],
  options: ModuleAccessMiddlewareOptions = {},
) {
  const requiredModules = normalizeCompanyModules(modules);
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

    if (requiredModules.length === 0 || user.role === "superadmin") {
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
    const hasAccess =
      match === "any"
        ? requiredModules.some((moduleKey) => enabledModules.has(moduleKey))
        : requiredModules.every((moduleKey) => enabledModules.has(moduleKey));

    if (hasAccess) {
      next();
      return;
    }

    response.status(403).json({
      message: `${formatModuleList(requiredModules)} is disabled for your company.`,
    });
  };
}
