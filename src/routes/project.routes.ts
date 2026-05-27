import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import projectModuleRoutes from "../modules/projects/projects.routes.js";

const projectRoutes = Router();

projectRoutes.use(
  ...protectedRoute({
    roles: ["project-manager", "team-lead"],
    permissions: ["projects:read"],
    modules: ["projects", "team-lead"],
    moduleMatch: "any",
  }),
);
projectRoutes.use("/", projectModuleRoutes);

export default projectRoutes;
