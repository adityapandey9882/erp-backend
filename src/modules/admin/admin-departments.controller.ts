import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminDepartmentsService } from "./admin-departments.service.js";

export const adminDepartmentsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminDepartmentsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
