import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { onboardingService } from "./onboarding.service.js";
import type {
  CreateOnboardingRequest,
  ReviewOnboardingRequest,
  TriggerOnboardingRequestAction,
  UpdateOnboardingRequestDetails,
} from "./onboarding.types.js";

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

export const onboardingController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await onboardingService.getWorkspace(request.auth, {
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

    const result = await onboardingService.createRequest(
      request.auth,
      request.body as CreateOnboardingRequest,
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
        message: "An onboarding request identifier is required.",
      });
      return;
    }

    const result = await onboardingService.reviewRequest(
      request.auth,
      requestId,
      request.body as ReviewOnboardingRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateRequestDetails(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An onboarding request identifier is required.",
      });
      return;
    }

    const result = await onboardingService.updateRequestDetails(
      request.auth,
      requestId,
      request.body as UpdateOnboardingRequestDetails,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async triggerRequestAction(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An onboarding request identifier is required.",
      });
      return;
    }

    const result = await onboardingService.triggerRequestAction(
      request.auth,
      requestId,
      request.body as TriggerOnboardingRequestAction,
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
        message: "An onboarding request identifier is required.",
      });
      return;
    }

    const result = await onboardingService.completeRequest(
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
