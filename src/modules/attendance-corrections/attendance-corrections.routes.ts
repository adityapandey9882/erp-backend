import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { attendanceCorrectionsController } from "./attendance-corrections.controller.js";
import {
  validateCreateAttendanceCorrectionPayload,
  validateReviewAttendanceCorrectionPayload,
} from "./attendance-corrections.validation.js";

export const employeeAttendanceCorrectionRoutes = Router();

employeeAttendanceCorrectionRoutes.get(
  "/",
  attendanceCorrectionsController.listEmployeeCorrections,
);
employeeAttendanceCorrectionRoutes.post(
  "/",
  validationMiddleware(validateCreateAttendanceCorrectionPayload),
  attendanceCorrectionsController.createEmployeeCorrection,
);

export const hrAttendanceCorrectionRoutes = Router();

hrAttendanceCorrectionRoutes.get(
  "/",
  attendanceCorrectionsController.listHrCorrections,
);
hrAttendanceCorrectionRoutes.patch(
  "/:id/review",
  validationMiddleware(validateReviewAttendanceCorrectionPayload),
  attendanceCorrectionsController.reviewHrCorrection,
);
