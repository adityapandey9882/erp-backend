import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminHolidayCalendarService } from "./admin-holiday-calendar.service.js";
import type {
  CreateHolidayRequest,
  UpdateHolidayRequest,
} from "./admin-holiday-calendar.types.js";

function readHolidayId(request: AuthenticatedRequest) {
  const value = request.params.holidayId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const adminHolidayCalendarController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await adminHolidayCalendarService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createHoliday(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await adminHolidayCalendarService.createHoliday(
      request.auth,
      request.body as CreateHolidayRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateHoliday(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const holidayId = readHolidayId(request);

    if (!holidayId) {
      response.status(400).json({ message: "A holiday identifier is required." });
      return;
    }

    const result = await adminHolidayCalendarService.updateHoliday(
      request.auth,
      holidayId,
      request.body as UpdateHolidayRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },
};
