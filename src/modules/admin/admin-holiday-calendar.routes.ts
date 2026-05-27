import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { adminHolidayCalendarController } from "./admin-holiday-calendar.controller.js";
import {
  validateCreateHolidayPayload,
  validateUpdateHolidayPayload,
} from "./admin-holiday-calendar.validation.js";

const adminHolidayCalendarRoutes = Router();

adminHolidayCalendarRoutes.get("/", adminHolidayCalendarController.getWorkspace);
adminHolidayCalendarRoutes.post(
  "/",
  validationMiddleware(validateCreateHolidayPayload),
  adminHolidayCalendarController.createHoliday,
);
adminHolidayCalendarRoutes.patch(
  "/:holidayId",
  validationMiddleware(validateUpdateHolidayPayload),
  adminHolidayCalendarController.updateHoliday,
);

export default adminHolidayCalendarRoutes;
