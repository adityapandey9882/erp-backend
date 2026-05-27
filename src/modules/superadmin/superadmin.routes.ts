import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { validateUpdateGlobalUserPayload } from "../users/users.validation.js";
import companiesRoutes from "../companies/companies.routes.js";
import notificationOpsRoutes from "../notifications/notification-ops.routes.js";
import { superadminController } from "./superadmin.controller.js";
import {
  validateCreateAdminPayload,
  validateSetAdminPasswordPayload,
  validateUnassignAdminPayload,
  validateUpdateAdminPayload,
  validateUpdateSuperadminSettingsPayload,
} from "./superadmin.validation.js";

const superadminRoutes = Router();

superadminRoutes.get("/", superadminController.getOverview);
superadminRoutes.get("/overview", superadminController.getOverview);
superadminRoutes.get("/audit-logs", superadminController.getAuditLogs);
superadminRoutes.get("/users", superadminController.getUsersWorkspace);
superadminRoutes.get("/users/:userId", superadminController.getUserProfile);
superadminRoutes.patch(
  "/users/:userId",
  validationMiddleware(validateUpdateGlobalUserPayload),
  superadminController.updateUser,
);
superadminRoutes.post(
  "/users/:userId/reset-password",
  superadminController.resetUserPassword,
);
superadminRoutes.post(
  "/users/:userId/force-logout",
  superadminController.forceLogoutUser,
);
superadminRoutes.patch(
  "/users/:userId/suspend",
  superadminController.suspendUser,
);
superadminRoutes.patch(
  "/users/:userId/resume",
  superadminController.resumeUser,
);
superadminRoutes.delete("/users/:userId", superadminController.deleteUser);
superadminRoutes.get("/admins", superadminController.getAdminsWorkspace);
superadminRoutes.post(
  "/admins",
  validationMiddleware(validateCreateAdminPayload),
  superadminController.createAdmin,
);
superadminRoutes.patch(
  "/admins/:adminId",
  validationMiddleware(validateUpdateAdminPayload),
  superadminController.updateAdmin,
);
superadminRoutes.post(
  "/admins/:adminId/reset-password",
  superadminController.resetAdminPassword,
);
superadminRoutes.post(
  "/admins/:adminId/password",
  validationMiddleware(validateSetAdminPasswordPayload),
  superadminController.setAdminPassword,
);
superadminRoutes.patch(
  "/admins/:adminId/unassign",
  validationMiddleware(validateUnassignAdminPayload),
  superadminController.unassignAdmin,
);
superadminRoutes.patch(
  "/admins/:adminId/suspend",
  superadminController.suspendAdmin,
);
superadminRoutes.patch(
  "/admins/:adminId/resume",
  superadminController.resumeAdmin,
);
superadminRoutes.patch(
  "/admins/:adminId/disable",
  superadminController.disableAdmin,
);
superadminRoutes.patch(
  "/admins/:adminId/enable",
  superadminController.enableAdmin,
);
superadminRoutes.delete("/admins/:adminId", superadminController.deleteAdmin);
superadminRoutes.get("/modules", superadminController.getModulesWorkspace);
superadminRoutes.get("/settings", superadminController.getSettings);
superadminRoutes.patch(
  "/settings",
  validationMiddleware(validateUpdateSuperadminSettingsPayload),
  superadminController.updateSettings,
);
superadminRoutes.use("/notifications", notificationOpsRoutes);
superadminRoutes.use("/companies", companiesRoutes);

export default superadminRoutes;
