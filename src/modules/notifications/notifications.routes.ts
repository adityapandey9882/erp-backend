import { Router } from "express";
import { protectedRoute } from "../../core/middleware/index.js";
import { notificationsController } from "./notifications.controller.js";

const notificationsRoutes = Router();

notificationsRoutes.use(...protectedRoute());
notificationsRoutes.get("/", notificationsController.getWorkspace);
notificationsRoutes.get("/unread-count", notificationsController.getUnreadCount);
notificationsRoutes.patch(
  "/read-all",
  notificationsController.markAllNotificationsRead,
);
notificationsRoutes.patch(
  "/:notificationId/read",
  notificationsController.markNotificationRead,
);

export default notificationsRoutes;
