import { Router } from "express";
import { permissionMiddleware } from "../../core/middleware/index.js";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { adminRolesController } from "./admin-roles.controller.js";
import {
  validateCreateRolePayload,
  validateUpdateRolePermissionsPayload,
  validateUpdateRolePayload,
} from "./admin-roles.validation.js";

const adminRolesRoutes = Router();

adminRolesRoutes.get(
  "/",
  permissionMiddleware(["roles:read", "permissions:read"], { match: "all" }),
  adminRolesController.getWorkspace,
);
adminRolesRoutes.post(
  "/",
  permissionMiddleware(["roles:create"]),
  validationMiddleware(validateCreateRolePayload),
  adminRolesController.createRole,
);
adminRolesRoutes.patch(
  "/:roleId",
  permissionMiddleware(["roles:update"]),
  validationMiddleware(validateUpdateRolePayload),
  adminRolesController.updateRole,
);
adminRolesRoutes.patch(
  "/:roleId/permissions",
  permissionMiddleware(["roles:assign", "permissions:update"], {
    match: "any",
  }),
  validationMiddleware(validateUpdateRolePermissionsPayload),
  adminRolesController.updateRolePermissions,
);

export default adminRolesRoutes;
