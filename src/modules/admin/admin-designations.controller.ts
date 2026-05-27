import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminDesignationsService } from "./admin-designations.service.js";

export const adminDesignationsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await adminDesignationsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },
};
