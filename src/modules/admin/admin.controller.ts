import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminService } from "./admin.service.js";

export const adminController = {
  async getOverview(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    response.status(200).json(await adminService.getOverview(request.auth));
  },
};
