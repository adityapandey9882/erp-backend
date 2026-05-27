import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { usersController } from "./users.controller.js";
import {
  validateCreateCompanyUserPayload,
  validateSendCompanyUserNotificationPayload,
  validateSetCompanyUserPasswordPayload,
  validateUpdateCompanyUserPayload,
  validateUpdateCompanyUserStatusPayload,
} from "./users.validation.js";

const usersRoutes = Router();

usersRoutes.get("/", usersController.getCompanyUsersWorkspace);
usersRoutes.post(
  "/",
  validationMiddleware(validateCreateCompanyUserPayload),
  usersController.createCompanyUser,
);
usersRoutes.post(
  "/notifications",
  validationMiddleware(validateSendCompanyUserNotificationPayload),
  usersController.sendCompanyUserNotification,
);
usersRoutes.patch(
  "/:userId",
  validationMiddleware(validateUpdateCompanyUserPayload),
  usersController.updateCompanyUser,
);
usersRoutes.patch(
  "/:userId/status",
  validationMiddleware(validateUpdateCompanyUserStatusPayload),
  usersController.updateCompanyUserStatus,
);
usersRoutes.get("/:userId/profile/photo", usersController.getCompanyUserProfilePhoto);
usersRoutes.post(
  "/:userId/reset-password",
  usersController.resetCompanyUserPassword,
);
usersRoutes.post(
  "/:userId/password",
  validationMiddleware(validateSetCompanyUserPasswordPayload),
  usersController.setCompanyUserPassword,
);
usersRoutes.delete("/:userId", usersController.deleteCompanyUser);

export default usersRoutes;
