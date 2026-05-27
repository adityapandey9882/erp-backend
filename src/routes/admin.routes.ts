import { Router } from "express";
import { protectedRoute, validationMiddleware } from "../core/middleware/index.js";
import adminModuleRoutes from "../modules/admin/admin.routes.js";
import { adminSettingsController } from "../modules/admin/admin-settings.controller.js";
import { validateCaptureAdminLocationSessionPayload } from "../modules/admin/admin-settings.validation.js";

const adminRoutes = Router();

adminRoutes.post(
  "/office-locations/location-capture-session/:sessionId/capture",
  validationMiddleware(validateCaptureAdminLocationSessionPayload),
  adminSettingsController.captureOfficeLocationFromSession,
);

adminRoutes.use(...protectedRoute({ roles: ["admin"], modules: ["admin"] }));
adminRoutes.use("/", adminModuleRoutes);

export default adminRoutes;
