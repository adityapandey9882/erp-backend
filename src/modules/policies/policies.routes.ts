import { Router } from "express";
import {
  permissionMiddleware,
  protectedRoute,
  validationMiddleware,
} from "../../core/middleware/index.js";
import { policiesController } from "./policies.controller.js";
import { validateUpdatePoliciesPayload } from "./policies.validation.js";

const policiesRoutes = Router();

policiesRoutes.use(...protectedRoute({ roles: ["admin"], modules: ["admin"] }));
policiesRoutes.get(
  "/",
  permissionMiddleware(["policies:read"]),
  policiesController.getWorkspace,
);
policiesRoutes.patch(
  "/",
  permissionMiddleware(["policies:update"]),
  validationMiddleware(validateUpdatePoliciesPayload),
  policiesController.updatePolicies,
);

export default policiesRoutes;
