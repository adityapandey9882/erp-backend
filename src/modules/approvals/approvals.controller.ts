import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { approvalsService } from "./approvals.service.js";
import type {
  CreateApprovalFlowRequest,
  UpdateApprovalFlowRequest,
} from "./approvals.validation.js";

function readFlowIdParam(request: AuthenticatedRequest) {
  const value = request.params.flowId;

  return typeof value === "string" ? value.trim() : "";
}

export const approvalsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await approvalsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createFlow(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await approvalsService.createFlow(
      request.auth,
      request.body as CreateApprovalFlowRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateFlow(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const flowId = readFlowIdParam(request);

    if (!flowId) {
      response.status(400).json({
        message: "A flow identifier is required.",
      });
      return;
    }

    const result = await approvalsService.updateFlow(
      request.auth,
      flowId,
      request.body as UpdateApprovalFlowRequest,
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

