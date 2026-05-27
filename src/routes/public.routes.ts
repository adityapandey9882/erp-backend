import { Router } from "express";
import { validationMiddleware } from "../core/middleware/validation.middleware.js";
import { attendanceService } from "../modules/attendance/attendance.service.js";
import { validateAttendanceQrSessionVerifyPayload } from "../modules/attendance/attendance.validation.js";
import type { VerifyAttendanceQrSessionRequest } from "../modules/attendance/attendance.types.js";
import { superadminSettingsRepository } from "../modules/superadmin/superadmin-settings.repository.js";

const publicRoutes = Router();

publicRoutes.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "company-management-erp-backend",
  });
});

publicRoutes.get("/platform/runtime", async (_request, response, next) => {
  try {
    const runtime = await superadminSettingsRepository.getPlatformRuntime();

    response.status(200).json(runtime);
  } catch (error) {
    next(error);
  }
});

publicRoutes.get(
  "/mobile/attendance/qr-session/:sessionId/status",
  async (request, response, next) => {
    try {
      const sessionIdParam = request.params.sessionId;
      const sessionId =
        typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";
      const token = typeof request.query.token === "string" ? request.query.token : "";

      if (!sessionId) {
        response.status(400).json({ message: "A QR session identifier is required." });
        return;
      }

      const result = await attendanceService.getPublicQrSessionStatus(sessionId, token);

      if (!result.ok) {
        response.status(result.status).json({ message: result.message });
        return;
      }

      response.status(200).json(result.data);
    } catch (error) {
      next(error);
    }
  },
);

publicRoutes.post(
  "/mobile/attendance/qr-session/:sessionId/verify",
  validationMiddleware(validateAttendanceQrSessionVerifyPayload),
  async (request, response, next) => {
    try {
      const sessionIdParam = request.params.sessionId;
      const sessionId =
        typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";

      if (!sessionId) {
        response.status(400).json({ message: "A QR session identifier is required." });
        return;
      }

      const result = await attendanceService.verifyPublicQrSession(
        sessionId,
        request.body as VerifyAttendanceQrSessionRequest,
      );

      if (!result.ok) {
        response.status(result.status).json({ message: result.message });
        return;
      }

      response.status(200).json(result.data);
    } catch (error) {
      next(error);
    }
  },
);

export default publicRoutes;
