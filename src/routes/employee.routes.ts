import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import employeeModuleRoutes from "../modules/employee-self/employee-self.routes.js";

const employeeRoutes = Router();

employeeRoutes.use(
  ...protectedRoute({ roles: ["employee"], modules: ["employee-self"] }),
);
employeeRoutes.use("/", employeeModuleRoutes);

export default employeeRoutes;
