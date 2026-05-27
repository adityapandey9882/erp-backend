import { Router } from "express";
import { permissionMiddleware, validationMiddleware } from "../../core/middleware/index.js";
import { onboardingController } from "./onboarding.controller.js";
import {
  validateCreateOnboardingRequestPayload,
  validateReviewOnboardingRequestPayload,
  validateTriggerOnboardingRequestActionPayload,
  validateUpdateOnboardingRequestDetailsPayload,
} from "./onboarding.validation.js";

const onboardingRoutes = Router();

onboardingRoutes.get(
  "/",
  permissionMiddleware(["onboarding:read"]),
  onboardingController.getWorkspace,
);
onboardingRoutes.post(
  "/",
  permissionMiddleware(["onboarding:update"]),
  validationMiddleware(validateCreateOnboardingRequestPayload),
  onboardingController.createRequest,
);
onboardingRoutes.patch(
  "/:requestId/details",
  permissionMiddleware(["onboarding:update"]),
  validationMiddleware(validateUpdateOnboardingRequestDetailsPayload),
  onboardingController.updateRequestDetails,
);
onboardingRoutes.post(
  "/:requestId/actions",
  permissionMiddleware(["onboarding:update"]),
  validationMiddleware(validateTriggerOnboardingRequestActionPayload),
  onboardingController.triggerRequestAction,
);
onboardingRoutes.patch(
  "/:requestId/review",
  permissionMiddleware(["onboarding:update"]),
  validationMiddleware(validateReviewOnboardingRequestPayload),
  onboardingController.reviewRequest,
);
onboardingRoutes.patch(
  "/:requestId/complete",
  permissionMiddleware(["onboarding:update"]),
  onboardingController.completeRequest,
);

export default onboardingRoutes;
