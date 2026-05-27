import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { adminOrganizationController } from "./admin-organization.controller.js";
import {
  validateCreateDepartmentPayload,
  validateCreateDesignationPayload,
  validateUpdateDepartmentPayload,
  validateUpdateDesignationPayload,
} from "./admin-organization.validation.js";

const adminOrganizationRoutes = Router();

adminOrganizationRoutes.get("/", adminOrganizationController.getWorkspace);
adminOrganizationRoutes.post(
  "/departments",
  validationMiddleware(validateCreateDepartmentPayload),
  adminOrganizationController.createDepartment,
);
adminOrganizationRoutes.patch(
  "/departments/:departmentId",
  validationMiddleware(validateUpdateDepartmentPayload),
  adminOrganizationController.updateDepartment,
);
adminOrganizationRoutes.post(
  "/designations",
  validationMiddleware(validateCreateDesignationPayload),
  adminOrganizationController.createDesignation,
);
adminOrganizationRoutes.patch(
  "/designations/:designationId",
  validationMiddleware(validateUpdateDesignationPayload),
  adminOrganizationController.updateDesignation,
);

export default adminOrganizationRoutes;
