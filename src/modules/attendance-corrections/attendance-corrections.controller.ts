import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { attendanceCorrectionsService } from "./attendance-corrections.service.js";
import type {
  CreateAttendanceCorrectionRequest,
  ReviewAttendanceCorrectionRequest,
} from "./attendance-corrections.types.js";

function readCorrectionIdParam(request: AuthenticatedRequest) {
  const value = request.params.id ?? request.params.correctionId;

  return typeof value === "string" ? value.trim() : "";
}

export const attendanceCorrectionsController = {
  async listEmployeeCorrections(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await attendanceCorrectionsService.listEmployeeCorrections(
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createEmployeeCorrection(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await attendanceCorrectionsService.createEmployeeCorrection(
      request.auth,
      request.body as CreateAttendanceCorrectionRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async listHrCorrections(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await attendanceCorrectionsService.listHrCorrections(
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async reviewHrCorrection(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const correctionId = readCorrectionIdParam(request);

    if (!correctionId) {
      response.status(400).json({
        message: "An attendance correction request identifier is required.",
      });
      return;
    }

    const result = await attendanceCorrectionsService.reviewHrCorrection(
      request.auth,
      correctionId,
      request.body as ReviewAttendanceCorrectionRequest,
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
