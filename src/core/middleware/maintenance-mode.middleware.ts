import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";
import { superadminSettingsRepository } from "../../modules/superadmin/superadmin-settings.repository.js";
import { isMaintenanceActiveForRole } from "../../modules/superadmin/maintenance-mode.js";

export async function maintenanceModeMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authenticatedRequest = request as AuthenticatedRequest;
  const user = authenticatedRequest.auth;

  if (!user || user.role === "superadmin") {
    next();
    return;
  }

  const runtime = await superadminSettingsRepository.getPlatformRuntime();

  if (!isMaintenanceActiveForRole(runtime, user.role)) {
    next();
    return;
  }

  response.status(503).json({
    message: `${runtime.platformName} is currently in maintenance mode for the ${user.role} dashboard. Only superadmin access is available right now.`,
    maintenanceMode: true,
    maintenanceScope: runtime.maintenanceScope,
    maintenanceTargets: runtime.maintenanceTargets,
    platformName: runtime.platformName,
    platformDomain: runtime.platformDomain,
    supportEmail: runtime.supportEmail,
  });
}
