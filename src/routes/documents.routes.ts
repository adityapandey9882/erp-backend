import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import documentsModuleRoutes from "../modules/documents/documents.routes.js";

const documentsRoutes = Router();

documentsRoutes.use(
  ...protectedRoute({
    roles: ["admin", "employee", "hr"],
    modules: ["admin", "employee-self", "hr"],
    moduleMatch: "any",
  }),
);
documentsRoutes.use("/", documentsModuleRoutes);

export default documentsRoutes;
