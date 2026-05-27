import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { permissionsService } from "./permissions.service.js";

export const permissionsController = {
  async getCatalog(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    response.status(200).json(await permissionsService.getCatalog());
  },
};
