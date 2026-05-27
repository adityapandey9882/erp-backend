import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { companiesController } from "./companies.controller.js";
import {
  validateAssignCompanyAdminPayload,
  validateCreateCompanyPayload,
  validateUpdateCompanyLogoPayload,
  validateUpdateCompanyModulesPayload,
  validateUpdateCompanyPayload,
  validateUpdateCompanyStatusPayload,
} from "./companies.validation.js";

const companiesRoutes = Router();

companiesRoutes.get("/", companiesController.list);
companiesRoutes.get("/:companyId", companiesController.detail);
companiesRoutes.post(
  "/",
  validationMiddleware(validateCreateCompanyPayload),
  companiesController.create,
);
companiesRoutes.patch(
  "/:companyId",
  validationMiddleware(validateUpdateCompanyPayload),
  companiesController.update,
);
companiesRoutes.patch(
  "/:companyId/status",
  validationMiddleware(validateUpdateCompanyStatusPayload),
  companiesController.updateStatus,
);
companiesRoutes.patch("/:companyId/archive", companiesController.archive);
companiesRoutes.patch("/:companyId/restore", companiesController.restore);
companiesRoutes.patch(
  "/:companyId/logo",
  validationMiddleware(validateUpdateCompanyLogoPayload),
  companiesController.updateLogo,
);
companiesRoutes.put(
  "/:companyId/admin",
  validationMiddleware(validateAssignCompanyAdminPayload),
  companiesController.assignAdmin,
);
companiesRoutes.put(
  "/:companyId/modules",
  validationMiddleware(validateUpdateCompanyModulesPayload),
  companiesController.updateModules,
);
companiesRoutes.delete("/:companyId", companiesController.remove);

export default companiesRoutes;
