import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { policiesService } from "./policies.service.js";
import type { UpdatePoliciesRequest } from "./policies.types.js";

export const policiesController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await policiesService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updatePolicies(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await policiesService.updatePolicies(
      request.auth,
      request.body as UpdatePoliciesRequest,
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
