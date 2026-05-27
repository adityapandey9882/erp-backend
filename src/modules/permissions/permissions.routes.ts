import { Router } from "express";
import { permissionMiddleware, protectedRoute } from "../../core/middleware/index.js";
import { permissionsController } from "./permissions.controller.js";

const permissionsRoutes = Router();

permissionsRoutes.use(...protectedRoute({ roles: ["admin"], modules: ["admin"] }));
permissionsRoutes.get(
  "/",
  permissionMiddleware(["permissions:read"]),
  permissionsController.getCatalog,
);

export default permissionsRoutes;
