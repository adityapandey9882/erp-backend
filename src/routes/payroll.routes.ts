import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import payrollModuleRoutes from "../modules/payroll/payroll.routes.js";

const payrollRoutes = Router();

payrollRoutes.use(
  ...protectedRoute({
    permissions: ["payroll:read"],
    modules: ["accounts", "payroll"],
    moduleMatch: "any",
  }),
);
payrollRoutes.use("/", payrollModuleRoutes);

export default payrollRoutes;
