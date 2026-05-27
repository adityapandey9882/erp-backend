import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminRolesService } from "./admin-roles.service.js";
import type {
  CreateRoleRequest,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from "./admin-roles.validation.js";

function readIdParam(request: AuthenticatedRequest, key: string) {
  const value = request.params[key];

  return typeof value === "string" ? value.trim() : "";
}

function readRoleIdParam(request: AuthenticatedRequest) {
  return readIdParam(request, "roleId");
}

export const adminRolesController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminRolesService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createRole(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await adminRolesService.createRole(
      request.auth,
      request.body as CreateRoleRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateRole(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const roleId = readRoleIdParam(request);

    if (!roleId) {
      response.status(400).json({
        message: "A role identifier is required.",
      });
      return;
    }

    const result = await adminRolesService.updateRole(
      request.auth,
      roleId,
      request.body as UpdateRoleRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateRolePermissions(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const roleId = readRoleIdParam(request);

    if (!roleId) {
      response.status(400).json({
        message: "A role identifier is required.",
      });
      return;
    }

    const result = await adminRolesService.updateRolePermissions(
      request.auth,
      roleId,
      (request.body as UpdateRolePermissionsRequest).permissionKeys,
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
