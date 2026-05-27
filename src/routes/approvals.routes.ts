import { Router } from "express";
import { protectedRoute } from "../core/middleware/index.js";
import approvalsExecutionRoutes from "../modules/approvals/approvals.execution.routes.js";

const approvalsRoutes = Router();

approvalsRoutes.use(...protectedRoute());
approvalsRoutes.use("/", approvalsExecutionRoutes);

export default approvalsRoutes;
