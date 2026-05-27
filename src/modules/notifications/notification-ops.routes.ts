import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { notificationOpsController } from "./notification-ops.controller.js";
import {
  validateUpdateNotificationPolicyPayload,
  validateUpdateNotificationRulePayload,
} from "./notification-ops.validation.js";

const notificationOpsRoutes = Router();

notificationOpsRoutes.get("/rules", notificationOpsController.getRules);
notificationOpsRoutes.patch(
  "/rules/:ruleId",
  validationMiddleware(validateUpdateNotificationRulePayload),
  notificationOpsController.updateRule,
);
notificationOpsRoutes.get("/policies", notificationOpsController.getPolicies);
notificationOpsRoutes.patch(
  "/policies/:policyId",
  validationMiddleware(validateUpdateNotificationPolicyPayload),
  notificationOpsController.updatePolicy,
);
notificationOpsRoutes.get(
  "/delivery-logs",
  notificationOpsController.getDeliveryLogs,
);
notificationOpsRoutes.get("/failed", notificationOpsController.getFailedLogs);
notificationOpsRoutes.post(
  "/retry/:logId",
  notificationOpsController.retryDelivery,
);
notificationOpsRoutes.get("/health", notificationOpsController.getHealth);

export default notificationOpsRoutes;
