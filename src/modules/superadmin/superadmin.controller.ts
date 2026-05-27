import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { isAppRole } from "../roles/roles.types.js";
import { usersService } from "../users/users.service.js";
import type { UpdateGlobalUserRequest } from "../users/users.types.js";
import { isGlobalUserAccountStatus } from "../users/users.types.js";
import { superadminService } from "./superadmin.service.js";
import type {
  CreateSuperadminAdminRequest,
  SetSuperadminAdminPasswordRequest,
  SuperadminAuditLogFilters,
  UnassignSuperadminAdminRequest,
  UpdateSuperadminAdminRequest,
  UpdateSuperadminSettingsRequest,
} from "./superadmin.types.js";

function readAdminId(request: AuthenticatedRequest) {
  const value = request.params.adminId;

  return typeof value === "string" ? value.trim() : "";
}

function readUserId(request: AuthenticatedRequest) {
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

export const superadminController = {
  async getOverview(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.getOverview(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAdminsWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.getAdminsWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getUsersWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const roleFilter = readOptionalQueryValue(request, ["role"]);
    const statusFilter = readOptionalQueryValue(request, ["status"]);
    const result = await usersService.getGlobalUsersWorkspace(request.auth, {
      search: readOptionalQueryValue(request, ["search", "q"]),
      role:
        roleFilter && isAppRole(roleFilter) && roleFilter !== "superadmin"
          ? roleFilter
          : undefined,
      status:
        statusFilter && isGlobalUserAccountStatus(statusFilter)
          ? statusFilter
          : undefined,
      companyId: readOptionalQueryValue(request, ["companyId", "company"]),
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

  async getUserProfile(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.getGlobalUserProfile(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.updateGlobalUser(
      request.auth,
      userId,
      request.body as UpdateGlobalUserRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resetUserPassword(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.resetGlobalUserPassword(
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

  async forceLogoutUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.forceLogoutGlobalUser(
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

  async suspendUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.suspendGlobalUser(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resumeUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.resumeGlobalUser(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteUser(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserId(request);

    if (!userId) {
      response.status(400).json({
        message: "A user identifier is required.",
      });
      return;
    }

    const result = await usersService.deleteGlobalUser(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getModulesWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.getModulesWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAuditLogs(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const filters: SuperadminAuditLogFilters = {
      companyId: readOptionalQueryValue(request, ["company", "companyId"]),
      action: readOptionalQueryValue(request, ["action"]),
      dateFrom: readOptionalQueryValue(request, ["from", "dateFrom"]),
      dateTo: readOptionalQueryValue(request, ["to", "dateTo"]),
      page: readOptionalPositiveInteger(request, ["page"]),
      pageSize: readOptionalPositiveInteger(request, ["pageSize"]),
    };

    const result = await superadminService.getAuditLogs(request.auth, filters);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.createAdmin(
      request.auth,
      request.body as CreateSuperadminAdminRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.updateAdmin(
      request.auth,
      adminId,
      request.body as UpdateSuperadminAdminRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resetAdminPassword(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.resetAdminPassword(
      request.auth,
      adminId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async setAdminPassword(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.setAdminPassword(
      request.auth,
      adminId,
      request.body as SetSuperadminAdminPasswordRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async unassignAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.unassignAdmin(
      request.auth,
      adminId,
      request.body as UnassignSuperadminAdminRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async suspendAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.suspendAdmin(request.auth, adminId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resumeAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.resumeAdmin(request.auth, adminId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async disableAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.disableAdmin(request.auth, adminId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async enableAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.enableAdmin(request.auth, adminId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteAdmin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const adminId = readAdminId(request);

    if (!adminId) {
      response.status(400).json({
        message: "An admin identifier is required.",
      });
      return;
    }

    const result = await superadminService.deleteAdmin(request.auth, adminId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.getSettings(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await superadminService.updateSettings(
      request.auth,
      request.body as UpdateSuperadminSettingsRequest,
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
