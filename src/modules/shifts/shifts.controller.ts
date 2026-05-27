import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { shiftsService } from "./shifts.service.js";
import type {
  AssignShiftRequest,
  CreateShiftRequest,
  UpdateShiftRequest,
} from "./shifts.types.js";

function readShiftIdParam(request: AuthenticatedRequest) {
  const value = request.params.shiftId;

  return typeof value === "string" ? value.trim() : "";
}

export const shiftsController = {
  async getHrWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await shiftsService.getHrWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createShift(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await shiftsService.createShift(
      request.auth,
      request.body as CreateShiftRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateShift(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const shiftId = readShiftIdParam(request);

    if (!shiftId) {
      response.status(400).json({
        message: "A shift identifier is required.",
      });
      return;
    }

    const result = await shiftsService.updateShift(
      request.auth,
      shiftId,
      request.body as UpdateShiftRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async assignShift(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await shiftsService.assignShift(
      request.auth,
      request.body as AssignShiftRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getEmployeeShift(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await shiftsService.getEmployeeShift(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
