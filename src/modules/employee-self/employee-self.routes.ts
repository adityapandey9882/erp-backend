import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import {
  validateAttendancePunchPayload,
  validateAttendanceQrSessionCreatePayload,
  validateAttendanceQrSessionVerifyPayload,
} from "../attendance/attendance.validation.js";
import { employeeAttendanceCorrectionRoutes } from "../attendance-corrections/attendance-corrections.routes.js";
import { employeeSelfController } from "./employee-self.controller.js";
import {
  validateCreateEmployeeAchievementPayload,
  validateCreateEmployeeEducationPayload,
  validateCreateEmployeeSkillPayload,
  validateCreateProfileChangeRequestPayload,
  validateUpdateEmployeeAchievementPayload,
  validateUpdateEmployeeEducationPayload,
  validateUpdateEmployeeSelfBankDetailsPayload,
  validateUpdateEmployeeSelfProfilePayload,
  validateUpdateEmployeeSelfSettingsPayload,
  validateUpdateEmployeeSkillPayload,
} from "./employee-self.validation.js";
import { validateCreateEmployeeLeavePayload } from "../leave/leave.validation.js";
import { employeeShiftRoutes } from "../shifts/shifts.routes.js";
import { employeeProfilePhotoUploadMiddleware } from "./employee-self.upload.js";

const employeeSelfRoutes = Router();

employeeSelfRoutes.get("/", employeeSelfController.getOverview);
employeeSelfRoutes.patch(
  "/profile",
  validationMiddleware(validateUpdateEmployeeSelfProfilePayload),
  employeeSelfController.updateProfile,
);
employeeSelfRoutes.patch(
  "/profile/bank-details",
  validationMiddleware(validateUpdateEmployeeSelfBankDetailsPayload),
  employeeSelfController.updateBankDetails,
);
employeeSelfRoutes.post(
  "/profile/photo",
  employeeProfilePhotoUploadMiddleware,
  employeeSelfController.uploadProfilePhoto,
);
employeeSelfRoutes.get("/profile/photo", employeeSelfController.getProfilePhoto);
employeeSelfRoutes.get("/settings", employeeSelfController.getSettings);
employeeSelfRoutes.patch(
  "/settings",
  validationMiddleware(validateUpdateEmployeeSelfSettingsPayload),
  employeeSelfController.updateSettings,
);
employeeSelfRoutes.get("/offices", employeeSelfController.getOfficeLocations);
employeeSelfRoutes.get("/site-locations", employeeSelfController.getSiteLocations);
employeeSelfRoutes.get("/attendance", employeeSelfController.getAttendanceWorkspace);
employeeSelfRoutes.get("/assets", employeeSelfController.getAssetsWorkspace);
employeeSelfRoutes.get("/assets/:assetId/events", employeeSelfController.getAssetEvents);
employeeSelfRoutes.use(
  "/attendance/correction",
  employeeAttendanceCorrectionRoutes,
);
employeeSelfRoutes.post(
  "/attendance/check-in",
  validationMiddleware(validateAttendancePunchPayload),
  employeeSelfController.checkIn,
);
employeeSelfRoutes.post(
  "/attendance/check-out",
  validationMiddleware(validateAttendancePunchPayload),
  employeeSelfController.checkOut,
);
employeeSelfRoutes.post(
  "/attendance/qr-session",
  validationMiddleware(validateAttendanceQrSessionCreatePayload),
  employeeSelfController.createAttendanceQrSession,
);
employeeSelfRoutes.get(
  "/attendance/qr-session/:sessionId/status",
  employeeSelfController.getAttendanceQrSessionStatus,
);
employeeSelfRoutes.patch(
  "/attendance/qr-session/:sessionId/cancel",
  employeeSelfController.cancelAttendanceQrSession,
);
employeeSelfRoutes.post(
  "/attendance/qr-session/:sessionId/verify",
  validationMiddleware(validateAttendanceQrSessionVerifyPayload),
  employeeSelfController.verifyAttendanceQrSession,
);
employeeSelfRoutes.use("/shift", employeeShiftRoutes);
employeeSelfRoutes.get("/leave", employeeSelfController.getLeaveWorkspace);
employeeSelfRoutes.post(
  "/leave",
  validationMiddleware(validateCreateEmployeeLeavePayload),
  employeeSelfController.requestLeave,
);
employeeSelfRoutes.get(
  "/calendar/upcoming",
  employeeSelfController.getUpcomingCalendar,
);
employeeSelfRoutes.get("/education", employeeSelfController.listEducation);
employeeSelfRoutes.post(
  "/education",
  validationMiddleware(validateCreateEmployeeEducationPayload),
  employeeSelfController.createEducation,
);
employeeSelfRoutes.patch(
  "/education/:educationId",
  validationMiddleware(validateUpdateEmployeeEducationPayload),
  employeeSelfController.updateEducation,
);
employeeSelfRoutes.delete(
  "/education/:educationId",
  employeeSelfController.deleteEducation,
);
employeeSelfRoutes.get("/skills", employeeSelfController.listSkills);
employeeSelfRoutes.post(
  "/skills",
  validationMiddleware(validateCreateEmployeeSkillPayload),
  employeeSelfController.createSkill,
);
employeeSelfRoutes.patch(
  "/skills/:skillId",
  validationMiddleware(validateUpdateEmployeeSkillPayload),
  employeeSelfController.updateSkill,
);
employeeSelfRoutes.delete("/skills/:skillId", employeeSelfController.deleteSkill);
employeeSelfRoutes.get("/achievements", employeeSelfController.listAchievements);
employeeSelfRoutes.post(
  "/achievements",
  validationMiddleware(validateCreateEmployeeAchievementPayload),
  employeeSelfController.createAchievement,
);
employeeSelfRoutes.patch(
  "/achievements/:achievementId",
  validationMiddleware(validateUpdateEmployeeAchievementPayload),
  employeeSelfController.updateAchievement,
);
employeeSelfRoutes.delete(
  "/achievements/:achievementId",
  employeeSelfController.deleteAchievement,
);
employeeSelfRoutes.get(
  "/profile-change-requests",
  employeeSelfController.listProfileChangeRequests,
);
employeeSelfRoutes.post(
  "/profile-change-requests",
  validationMiddleware(validateCreateProfileChangeRequestPayload),
  employeeSelfController.createProfileChangeRequest,
);
employeeSelfRoutes.get("/payroll/payslips", employeeSelfController.getPayslips);
employeeSelfRoutes.get("/announcements", employeeSelfController.getAnnouncements);
employeeSelfRoutes.get(
  "/announcements/recent",
  employeeSelfController.getRecentAnnouncements,
);
employeeSelfRoutes.post(
  "/announcements/:announcementId/seen",
  employeeSelfController.markAnnouncementSeen,
);
employeeSelfRoutes.post(
  "/announcements/:announcementId/acknowledge",
  employeeSelfController.acknowledgeAnnouncement,
);
employeeSelfRoutes.patch(
  "/announcements/:announcementId/important",
  employeeSelfController.updateAnnouncementImportance,
);

export default employeeSelfRoutes;
