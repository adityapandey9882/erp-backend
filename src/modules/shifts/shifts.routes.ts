import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { shiftsController } from "./shifts.controller.js";
import {
  validateAssignShiftPayload,
  validateCreateShiftPayload,
  validateUpdateShiftPayload,
} from "./shifts.validation.js";

export const hrShiftsRoutes = Router();

hrShiftsRoutes.get("/", shiftsController.getHrWorkspace);
hrShiftsRoutes.post(
  "/",
  validationMiddleware(validateCreateShiftPayload),
  shiftsController.createShift,
);
hrShiftsRoutes.patch(
  "/:shiftId",
  validationMiddleware(validateUpdateShiftPayload),
  shiftsController.updateShift,
);
hrShiftsRoutes.post(
  "/assign",
  validationMiddleware(validateAssignShiftPayload),
  shiftsController.assignShift,
);

export const employeeShiftRoutes = Router();

employeeShiftRoutes.get("/", shiftsController.getEmployeeShift);
