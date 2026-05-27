import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "../departments/departments.types.js";
import type {
  CreateDesignationRequest,
  UpdateDesignationRequest,
} from "../designations/designations.types.js";
import { adminOrganizationService } from "./admin-organization.service.js";

function readIdParam(request: AuthenticatedRequest, key: string) {
  const value = request.params[key];

  return typeof value === "string" ? value.trim() : "";
}

export const adminOrganizationController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminOrganizationService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createDepartment(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminOrganizationService.createDepartment(
      request.auth,
      request.body as CreateDepartmentRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateDepartment(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const departmentId = readIdParam(request, "departmentId");

    if (!departmentId) {
      response.status(400).json({
        message: "A department identifier is required.",
      });
      return;
    }

    const result = await adminOrganizationService.updateDepartment(
      request.auth,
      departmentId,
      request.body as UpdateDepartmentRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createDesignation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminOrganizationService.createDesignation(
      request.auth,
      request.body as CreateDesignationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateDesignation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const designationId = readIdParam(request, "designationId");

    if (!designationId) {
      response.status(400).json({
        message: "A designation identifier is required.",
      });
      return;
    }

    const result = await adminOrganizationService.updateDesignation(
      request.auth,
      designationId,
      request.body as UpdateDesignationRequest,
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
