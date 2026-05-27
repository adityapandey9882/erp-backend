import { Router } from "express";
import {
  protectedRoute,
  roleScopedModuleAccessMiddleware,
} from "../core/middleware/index.js";
import assetsModuleRoutes from "../modules/assets/assets.routes.js";

const assetsRoutes = Router();

assetsRoutes.use(
  ...protectedRoute({
    roles: ["admin", "hr"],
    permissions: ["users:read", "employees:read"],
    permissionMatch: "any",
  }),
);
assetsRoutes.use(
  roleScopedModuleAccessMiddleware({
    admin: ["admin"],
    hr: ["hr"],
  }),
);
assetsRoutes.use("/", assetsModuleRoutes);

export default assetsRoutes;
