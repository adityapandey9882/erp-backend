import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { adminSettingsController } from "./admin-settings.controller.js";
import { adminController } from "./admin.controller.js";
import announcementsRoutes from "../announcements/announcements.routes.js";
import approvalsRoutes from "../approvals/approvals.routes.js";
import auditRoutes from "../audit/audit.routes.js";
import adminDepartmentsRoutes from "./admin-departments.routes.js";
import adminDesignationsRoutes from "./admin-designations.routes.js";
import adminHolidayCalendarRoutes from "./admin-holiday-calendar.routes.js";
import adminLeaveManagementRoutes from "./admin-leave-management.routes.js";
import policiesRoutes from "../policies/policies.routes.js";
import adminOrganizationRoutes from "./admin-organization.routes.js";
import adminRolesRoutes from "./admin-roles.routes.js";
import permissionsRoutes from "../permissions/permissions.routes.js";
import usersRoutes from "../users/users.routes.js";
import {
  validateCaptureAdminLocationSessionPayload,
  validateCreateAdminBiometricDevicePayload,
  validateCreateAdminOfficeLocationPayload,
  validateCreateAdminSiteLocationPayload,
  validateUpdateAdminAttendanceSettingsPayload,
  validateUpdateAdminBiometricDevicePayload,
  validateUpdateAdminCompanyProfilePayload,
  validateUpdateAdminNotificationSettingsPayload,
  validateUpdateAdminOfficeLocationPayload,
  validateUpdateAdminSiteLocationPayload,
  validateUpdateAdminPayrollSettingsPayload,
} from "./admin-settings.validation.js";

const adminRoutes = Router();

adminRoutes.get("/", adminController.getOverview);
adminRoutes.get("/settings", adminSettingsController.getWorkspace);
adminRoutes.patch(
  "/settings/company-profile",
  validationMiddleware(validateUpdateAdminCompanyProfilePayload),
  adminSettingsController.updateCompanyProfile,
);
adminRoutes.get("/settings/attendance", adminSettingsController.getAttendanceSettings);
adminRoutes.patch(
  "/settings/attendance",
  validationMiddleware(validateUpdateAdminAttendanceSettingsPayload),
  adminSettingsController.updateAttendanceSettings,
);
adminRoutes.get("/settings/payroll", adminSettingsController.getPayrollSettings);
adminRoutes.patch(
  "/settings/payroll",
  validationMiddleware(validateUpdateAdminPayrollSettingsPayload),
  adminSettingsController.updatePayrollSettings,
);
adminRoutes.get(
  "/settings/notifications",
  adminSettingsController.getNotificationSettings,
);
adminRoutes.patch(
  "/settings/notifications",
  validationMiddleware(validateUpdateAdminNotificationSettingsPayload),
  adminSettingsController.updateNotificationSettings,
);
adminRoutes.get("/office-locations", adminSettingsController.listOfficeLocations);
adminRoutes.post(
  "/office-locations",
  validationMiddleware(validateCreateAdminOfficeLocationPayload),
  adminSettingsController.createOfficeLocation,
);
adminRoutes.patch(
  "/office-locations/:officeLocationId",
  validationMiddleware(validateUpdateAdminOfficeLocationPayload),
  adminSettingsController.updateOfficeLocation,
);
adminRoutes.post(
  "/office-locations/location-capture-session",
  adminSettingsController.createOfficeLocationCaptureSession,
);
adminRoutes.get(
  "/office-locations/location-capture-session/:sessionId/status",
  adminSettingsController.getOfficeLocationCaptureSessionStatus,
);
adminRoutes.patch(
  "/office-locations/location-capture-session/:sessionId/cancel",
  adminSettingsController.cancelOfficeLocationCaptureSession,
);
adminRoutes.post(
  "/office-locations/location-capture-session/:sessionId/capture",
  validationMiddleware(validateCaptureAdminLocationSessionPayload),
  adminSettingsController.captureOfficeLocationFromSession,
);
adminRoutes.delete(
  "/office-locations/:officeLocationId",
  adminSettingsController.deactivateOfficeLocation,
);
adminRoutes.get("/site-locations", adminSettingsController.listSiteLocations);
adminRoutes.post(
  "/site-locations",
  validationMiddleware(validateCreateAdminSiteLocationPayload),
  adminSettingsController.createSiteLocation,
);
adminRoutes.patch(
  "/site-locations/:siteLocationId",
  validationMiddleware(validateUpdateAdminSiteLocationPayload),
  adminSettingsController.updateSiteLocation,
);
adminRoutes.delete(
  "/site-locations/:siteLocationId",
  adminSettingsController.deactivateSiteLocation,
);
adminRoutes.get("/biometric-devices", adminSettingsController.listBiometricDevices);
adminRoutes.post(
  "/biometric-devices",
  validationMiddleware(validateCreateAdminBiometricDevicePayload),
  adminSettingsController.createBiometricDevice,
);
adminRoutes.patch(
  "/biometric-devices/:deviceId",
  validationMiddleware(validateUpdateAdminBiometricDevicePayload),
  adminSettingsController.updateBiometricDevice,
);
adminRoutes.delete(
  "/biometric-devices/:deviceId",
  adminSettingsController.deactivateBiometricDevice,
);
adminRoutes.post(
  "/biometric-devices/:deviceId/sync",
  adminSettingsController.syncBiometricDevice,
);
adminRoutes.use("/users", usersRoutes);
adminRoutes.use("/departments", adminDepartmentsRoutes);
adminRoutes.use("/designations", adminDesignationsRoutes);
adminRoutes.use("/organization", adminOrganizationRoutes);
adminRoutes.use("/leave-management", adminLeaveManagementRoutes);
adminRoutes.use("/roles", adminRolesRoutes);
adminRoutes.use("/announcements", announcementsRoutes);
adminRoutes.use("/holiday-calendar", adminHolidayCalendarRoutes);
adminRoutes.use("/approvals", approvalsRoutes);
adminRoutes.use("/audit-logs", auditRoutes);
adminRoutes.use("/policies", policiesRoutes);
adminRoutes.use("/permissions", permissionsRoutes);

export default adminRoutes;
