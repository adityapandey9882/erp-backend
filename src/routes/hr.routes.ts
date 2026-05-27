import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import hrModuleRoutes from "../modules/hr/hr.routes.js";

const hrRoutes = Router();

hrRoutes.use(...protectedRoute({ roles: ["hr"], modules: ["hr"] }));
hrRoutes.use("/", hrModuleRoutes);

export default hrRoutes;
