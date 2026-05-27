import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/index.js";
import { announcementsController } from "./announcements.controller.js";
import {
  validateCreateAnnouncementPayload,
  validateUpdateAnnouncementPayload,
} from "./announcements.validation.js";

const announcementsRoutes = Router();

announcementsRoutes.get("/", announcementsController.getWorkspace);
announcementsRoutes.post(
  "/",
  validationMiddleware(validateCreateAnnouncementPayload),
  announcementsController.createAnnouncement,
);
announcementsRoutes.patch(
  "/:announcementId",
  validationMiddleware(validateUpdateAnnouncementPayload),
  announcementsController.updateAnnouncement,
);

export default announcementsRoutes;
