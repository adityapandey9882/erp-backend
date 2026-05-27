import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { auditService } from "./audit.service.js";

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

export const auditController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await auditService.getWorkspace(request.auth, {
      userId: readOptionalQueryValue(request, ["user", "userId"]),
      action: readOptionalQueryValue(request, ["action"]),
      entityType: readOptionalQueryValue(request, ["entity_type", "entityType"]),
    });

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
