import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import announcementsRoutes from "../announcements/announcements.routes.js";
import { hrAttendanceCorrectionRoutes } from "../attendance-corrections/attendance-corrections.routes.js";
import onboardingRoutes from "../onboarding/onboarding.routes.js";
import offboardingRoutes from "../offboarding/offboarding.routes.js";
import { hrShiftsRoutes } from "../shifts/shifts.routes.js";
import { hrController } from "./hr.controller.js";
import {
  validateImportHrEmployeesPayload,
  validateUpdateHrEmployeeProfilePayload,
} from "./hr.validation.js";
import { validateUpdateHrLeaveStatusPayload } from "../leave/leave.validation.js";
import {
  validateReviewProfileChangeRequestPayload,
  validateUpdateEmployeeSelfBankDetailsPayload,
  validateUpdateEmployeeSelfProfilePayload,
} from "../employee-self/employee-self.validation.js";
import { employeeSelfController } from "../employee-self/employee-self.controller.js";
import { employeeProfilePhotoUploadMiddleware } from "../employee-self/employee-self.upload.js";
import { usersController } from "../users/users.controller.js";
import {
  validateCreateHolidayPayload,
  validateUpdateHolidayPayload,
} from "../admin/admin-holiday-calendar.validation.js";

const hrRoutes = Router();

hrRoutes.get("/", hrController.getOverview);
hrRoutes.get("/profile", employeeSelfController.getOverview);
hrRoutes.patch(
  "/profile",
  validationMiddleware(validateUpdateEmployeeSelfProfilePayload),
  employeeSelfController.updateProfile,
);
hrRoutes.patch(
  "/profile/bank-details",
  validationMiddleware(validateUpdateEmployeeSelfBankDetailsPayload),
  employeeSelfController.updateBankDetails,
);
hrRoutes.post(
  "/profile/photo",
  employeeProfilePhotoUploadMiddleware,
  employeeSelfController.uploadProfilePhoto,
);
hrRoutes.get("/profile/photo", employeeSelfController.getProfilePhoto);
hrRoutes.get("/attendance", hrController.getAttendanceWorkspace);
hrRoutes.use("/attendance/corrections", hrAttendanceCorrectionRoutes);
hrRoutes.use("/announcements", announcementsRoutes);
hrRoutes.get("/leave", hrController.getLeaveWorkspace);
hrRoutes.get("/holidays", hrController.getHolidayCalendarWorkspace);
hrRoutes.post(
  "/holidays",
  validationMiddleware(validateCreateHolidayPayload),
  hrController.createHoliday,
);
hrRoutes.patch(
  "/holidays/:holidayId",
  validationMiddleware(validateUpdateHolidayPayload),
  hrController.updateHoliday,
);
hrRoutes.use("/shifts", hrShiftsRoutes);
hrRoutes.use("/onboarding", onboardingRoutes);
hrRoutes.use("/offboarding", offboardingRoutes);
hrRoutes.get("/employees", hrController.getEmployeeDirectory);
hrRoutes.post(
  "/employees/import",
  validationMiddleware(validateImportHrEmployeesPayload),
  hrController.importEmployees,
);
hrRoutes.get(
  "/employees/:userId/profile/photo",
  usersController.getCompanyUserProfilePhoto,
);
hrRoutes.get("/employees/:userId", hrController.getEmployeeDetail);
hrRoutes.get(
  "/profile-change-requests",
  hrController.listProfileChangeRequests,
);
hrRoutes.patch(
  "/profile-change-requests/:requestId/review",
  validationMiddleware(validateReviewProfileChangeRequestPayload),
  hrController.reviewProfileChangeRequest,
);
hrRoutes.patch(
  "/leave/:leaveId/status",
  validationMiddleware(validateUpdateHrLeaveStatusPayload),
  hrController.updateLeaveStatus,
);
hrRoutes.patch(
  "/employees/:userId/profile",
  validationMiddleware(validateUpdateHrEmployeeProfilePayload),
  hrController.updateEmployeeProfile,
);

export default hrRoutes;
