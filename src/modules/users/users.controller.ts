import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { isAppRole } from "../roles/roles.types.js";
import { usersService } from "./users.service.js";
import type {
  CreateCompanyUserRequest,
  SendCompanyUserNotificationRequest,
  SetCompanyUserPasswordRequest,
  UpdateCompanyUserRequest,
  UpdateCompanyUserStatusRequest,
} from "./users.types.js";
import { isUserAccountStatus } from "./users.types.js";

function readUserIdParam(request: AuthenticatedRequest) {
  const value = request.params.userId;

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

function readOptionalPositiveInteger(
  request: AuthenticatedRequest,
  keys: readonly string[],
) {
  const value = readOptionalQueryValue(request, keys);

  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

export const usersController = {
  async getCompanyUsersWorkspace(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const roleFilter = readOptionalQueryValue(request, ["role"]);
    const statusFilter = readOptionalQueryValue(request, ["status"]);
    const result = await usersService.getCompanyUsersWorkspace(request.auth, {
      search: readOptionalQueryValue(request, ["search", "q"]),
      departmentId: readOptionalQueryValue(request, ["departmentId", "department"]),
      office: readOptionalQueryValue(request, ["office", "workLocation"]),
      role:
        roleFilter && isAppRole(roleFilter) && roleFilter !== "superadmin"
          ? roleFilter
          : undefined,
      status:
        statusFilter && isUserAccountStatus(statusFilter)
          ? statusFilter
          : undefined,
      page: readOptionalPositiveInteger(request, ["page"]),
      pageSize: readOptionalPositiveInteger(request, ["pageSize"]),
    });

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createCompanyUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await usersService.createCompanyUser(
      request.auth,
      request.body as CreateCompanyUserRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateCompanyUserStatus(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.updateCompanyUserStatus(
      request.auth,
      userId,
      request.body as UpdateCompanyUserStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async sendCompanyUserNotification(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await usersService.sendCompanyUserNotification(
      request.auth,
      request.body as SendCompanyUserNotificationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateCompanyUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.updateCompanyUser(
      request.auth,
      userId,
      request.body as UpdateCompanyUserRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resetCompanyUserPassword(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.resetCompanyUserPassword(
      request.auth,
      userId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async setCompanyUserPassword(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.setCompanyUserPassword(
      request.auth,
      userId,
      request.body as SetCompanyUserPasswordRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getCompanyUserProfilePhoto(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.getCompanyUserProfilePhoto(
      request.auth,
      userId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.setHeader("Content-Type", result.data.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.status(200).send(result.data.buffer);
  },

  async deleteCompanyUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.deleteCompanyUser(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
