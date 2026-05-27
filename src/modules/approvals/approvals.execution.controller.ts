import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { approvalsExecutionService } from "./approvals.execution.service.js";
import type {
  ApprovalDecisionPayload,
  ApprovalRequestListFilters,
  CreateApprovalRequestPayload,
} from "./approvals.types.js";

function readParam(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readQueryString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function readQueryNumber(value: unknown) {
  const normalized = readQueryString(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readListFilters(request: AuthenticatedRequest): ApprovalRequestListFilters {
  const status = readQueryString(request.query.status);
  const module = readQueryString(request.query.module);
  const search = readQueryString(request.query.search);
  const page = readQueryNumber(request.query.page);
  const pageSize = readQueryNumber(request.query.pageSize);

  return {
    status: (status as ApprovalRequestListFilters["status"]) ?? null,
    module: module ?? null,
    search: search ?? null,
    page,
    pageSize,
  };
}

function sendResult(
  response: Response,
  result:
    | { ok: true; data: unknown }
    | { ok: false; status: 400 | 403 | 404 | 409; message: string },
  successStatus = 200,
) {
  if (!result.ok) {
    response.status(result.status).json({
      message: result.message,
    });
    return;
  }

  response.status(successStatus).json(result.data);
}

export const approvalsExecutionController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await approvalsExecutionService.getWorkspace(
      request.auth,
      readListFilters(request),
    );

    sendResult(response, result);
  },

  async getMyApprovals(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await approvalsExecutionService.getMyApprovals(
      request.auth,
      readListFilters(request),
    );

    sendResult(response, result);
  },

  async getRequestDetail(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readParam(request.params.requestId);

    if (!requestId) {
      response.status(400).json({
        message: "An approval request identifier is required.",
      });
      return;
    }

    const result = await approvalsExecutionService.getRequestDetail(
      request.auth,
      requestId,
    );

    sendResult(response, result);
  },

  async createRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await approvalsExecutionService.createRequest(
      request.auth,
      request.body as CreateApprovalRequestPayload,
    );

    sendResult(response, result, 201);
  },

  async approveRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readParam(request.params.requestId);

    if (!requestId) {
      response.status(400).json({
        message: "An approval request identifier is required.",
      });
      return;
    }

    const result = await approvalsExecutionService.approveRequest(
      request.auth,
      requestId,
      request.body as ApprovalDecisionPayload,
    );

    sendResult(response, result);
  },

  async rejectRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readParam(request.params.requestId);

    if (!requestId) {
      response.status(400).json({
        message: "An approval request identifier is required.",
      });
      return;
    }

    const result = await approvalsExecutionService.rejectRequest(
      request.auth,
      requestId,
      request.body as ApprovalDecisionPayload,
    );

    sendResult(response, result);
  },
};
