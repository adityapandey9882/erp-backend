import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { announcementsService } from "./announcements.service.js";
import type {
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from "./announcements.types.js";

function readAnnouncementIdParam(request: AuthenticatedRequest) {
  const value = request.params.announcementId;

  return typeof value === "string" ? value.trim() : "";
}

export const announcementsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await announcementsService.getManagementWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAnnouncement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await announcementsService.createAnnouncement(
      request.auth,
      request.body as CreateAnnouncementRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateAnnouncement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const announcementId = readAnnouncementIdParam(request);

    if (!announcementId) {
      response.status(400).json({
        message: "An announcement identifier is required.",
      });
      return;
    }

    const result = await announcementsService.updateAnnouncement(
      request.auth,
      announcementId,
      request.body as UpdateAnnouncementRequest,
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
