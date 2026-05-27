import { Router } from "express";
import { permissionMiddleware, validationMiddleware } from "../../core/middleware/index.js";
import { offboardingController } from "./offboarding.controller.js";
import {
  validateCreateOffboardingRequestPayload,
  validateReviewOffboardingRequestPayload,
  validateTriggerOffboardingRequestActionPayload,
  validateUpdateOffboardingRequestDetailsPayload,
} from "./offboarding.validation.js";

const offboardingRoutes = Router();

offboardingRoutes.get(
  "/",
  permissionMiddleware(["offboarding:read"]),
  offboardingController.getWorkspace,
);
offboardingRoutes.post(
  "/",
  permissionMiddleware(["offboarding:update"]),
  validationMiddleware(validateCreateOffboardingRequestPayload),
  offboardingController.createRequest,
);
offboardingRoutes.patch(
  "/:requestId/details",
  permissionMiddleware(["offboarding:update"]),
  validationMiddleware(validateUpdateOffboardingRequestDetailsPayload),
  offboardingController.updateRequestDetails,
);
offboardingRoutes.post(
  "/:requestId/actions",
  permissionMiddleware(["offboarding:update"]),
  validationMiddleware(validateTriggerOffboardingRequestActionPayload),
  offboardingController.triggerRequestAction,
);
offboardingRoutes.patch(
  "/:requestId/review",
  permissionMiddleware(["offboarding:update"]),
  validationMiddleware(validateReviewOffboardingRequestPayload),
  offboardingController.reviewRequest,
);
offboardingRoutes.patch(
  "/:requestId/complete",
  permissionMiddleware(["offboarding:update"]),
  offboardingController.completeRequest,
);

export default offboardingRoutes;
