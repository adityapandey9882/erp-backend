import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { offboardingService } from "./offboarding.service.js";
import type {
  CreateOffboardingRequest,
  ReviewOffboardingRequest,
  TriggerOffboardingRequestAction,
  UpdateOffboardingRequestDetails,
} from "./offboarding.types.js";

function readRequestIdParam(request: AuthenticatedRequest) {
  const value = request.params.requestId;

  return typeof value === "string" ? value.trim() : "";
}

function readOptionalQueryValue(
  request: AuthenticatedRequest,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = request.query[key];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

export const offboardingController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await offboardingService.getWorkspace(request.auth, {
      userId: readOptionalQueryValue(request, ["user", "userId"]),
      status: readOptionalQueryValue(request, ["status"]),
    });

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await offboardingService.createRequest(
      request.auth,
      request.body as CreateOffboardingRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async reviewRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await offboardingService.reviewRequest(
      request.auth,
      requestId,
      request.body as ReviewOffboardingRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateRequestDetails(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await offboardingService.updateRequestDetails(
      request.auth,
      requestId,
      request.body as UpdateOffboardingRequestDetails,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async triggerRequestAction(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await offboardingService.triggerRequestAction(
      request.auth,
      requestId,
      request.body as TriggerOffboardingRequestAction,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async completeRequest(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await offboardingService.completeRequest(
      request.auth,
      requestId,
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
