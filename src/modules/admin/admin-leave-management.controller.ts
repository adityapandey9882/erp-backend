import type { Response } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { leaveService } from "../leave/leave.service.js";
import { validateUpdateHrLeaveStatusPayload } from "../leave/leave.validation.js";
import type { UpdateHrLeaveStatusRequest } from "../leave/leave.types.js";

function readLeaveIdParam(request: AuthenticatedRequest) {
  const value = request.params.leaveId;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const adminLeaveManagementController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await leaveService.getHrWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateLeaveStatus(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const leaveId = readLeaveIdParam(request);

    if (!leaveId) {
      response.status(400).json({
        message: "A leave request identifier is required.",
      });
      return;
    }

    const result = await leaveService.reviewLeave(
      request.auth,
      leaveId,
      request.body as UpdateHrLeaveStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};

export const validateAdminLeaveStatusUpdate = validationMiddleware(
  validateUpdateHrLeaveStatusPayload,
);
