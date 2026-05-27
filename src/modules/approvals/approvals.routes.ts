import { Router } from "express";
import { permissionMiddleware, validationMiddleware } from "../../core/middleware/index.js";
import { approvalsController } from "./approvals.controller.js";
import {
  validateCreateApprovalFlowPayload,
  validateUpdateApprovalFlowPayload,
} from "./approvals.validation.js";

const approvalsRoutes = Router();

approvalsRoutes.get(
  "/",
  permissionMiddleware(["approvals:read"]),
  approvalsController.getWorkspace,
);
approvalsRoutes.post(
  "/",
  permissionMiddleware(["approvals:update"]),
  validationMiddleware(validateCreateApprovalFlowPayload),
  approvalsController.createFlow,
);
approvalsRoutes.patch(
  "/:flowId",
  permissionMiddleware(["approvals:update"]),
  validationMiddleware(validateUpdateApprovalFlowPayload),
  approvalsController.updateFlow,
);

export default approvalsRoutes;
