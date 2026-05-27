import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import superadminModuleRoutes from "../modules/superadmin/superadmin.routes.js";

const superadminRoutes = Router();

superadminRoutes.use(...protectedRoute({ roles: ["superadmin"] }));
superadminRoutes.use("/", superadminModuleRoutes);

export default superadminRoutes;
