import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { notificationsService } from "./notifications.service.js";

function readNotificationIdParam(request: AuthenticatedRequest) {
  const value = request.params.notificationId;

  return typeof value === "string" ? value.trim() : "";
}

export const notificationsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await notificationsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getUnreadCount(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await notificationsService.getUnreadCount(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async markNotificationRead(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const notificationId = readNotificationIdParam(request);

    if (!notificationId) {
      response.status(400).json({
        message: "A notification identifier is required.",
      });
      return;
    }

    const result = await notificationsService.markNotificationRead(
      request.auth,
      notificationId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async markAllNotificationsRead(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await notificationsService.markAllNotificationsRead(
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
};
