import { Router } from "express";
import { permissionMiddleware, validationMiddleware } from "../../core/middleware/index.js";
import { approvalsExecutionController } from "./approvals.execution.controller.js";
import {
  validateApprovalDecisionPayload,
  validateCreateApprovalRequestPayload,
} from "./approvals.validation.js";

const approvalsExecutionRoutes = Router();

approvalsExecutionRoutes.get(
  "/",
  permissionMiddleware(["approvals:read"]),
  approvalsExecutionController.getWorkspace,
);
approvalsExecutionRoutes.get(
  "/my",
  approvalsExecutionController.getMyApprovals,
);
approvalsExecutionRoutes.post(
  "/",
  permissionMiddleware(["approvals:update"]),
  validationMiddleware(validateCreateApprovalRequestPayload),
  approvalsExecutionController.createRequest,
);
approvalsExecutionRoutes.get(
  "/:requestId",
  approvalsExecutionController.getRequestDetail,
);
approvalsExecutionRoutes.post(
  "/:requestId/approve",
  validationMiddleware(validateApprovalDecisionPayload),
  approvalsExecutionController.approveRequest,
);
approvalsExecutionRoutes.post(
  "/:requestId/reject",
  validationMiddleware(validateApprovalDecisionPayload),
  approvalsExecutionController.rejectRequest,
);

export default approvalsExecutionRoutes;
