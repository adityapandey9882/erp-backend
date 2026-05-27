import { Router } from "express";
import {
  permissionMiddleware,
  protectedRoute,
} from "../../core/middleware/index.js";
import { auditController } from "./audit.controller.js";

const auditRoutes = Router();

auditRoutes.use(...protectedRoute({ roles: ["admin"], modules: ["admin"] }));
auditRoutes.get("/", permissionMiddleware(["audit:read"]), auditController.getWorkspace);

export default auditRoutes;
