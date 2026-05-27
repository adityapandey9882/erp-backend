import { Router } from "express";
import assetsRoutes from "./assets.routes.js";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import documentsRoutes from "./documents.routes.js";
import employeeRoutes from "./employee.routes.js";
import hrRoutes from "./hr.routes.js";
import payrollRoutes from "./payroll.routes.js";
import projectRoutes from "./project.routes.js";
import publicRoutes from "./public.routes.js";
import approvalsRoutes from "./approvals.routes.js";
import superadminRoutes from "./superadmin.routes.js";
import notificationsRoutes from "../modules/notifications/notifications.routes.js";

const router = Router();

const routeRegistry = [
  { path: "/", handler: publicRoutes },
  { path: "/auth", handler: authRoutes },
  { path: "/superadmin", handler: superadminRoutes },
  { path: "/admin", handler: adminRoutes },
  { path: "/hr", handler: hrRoutes },
  { path: "/assets", handler: assetsRoutes },
  { path: "/notifications", handler: notificationsRoutes },
  { path: "/approvals", handler: approvalsRoutes },
  { path: "/payroll", handler: payrollRoutes },
  { path: "/project", handler: projectRoutes },
  { path: "/employee", handler: employeeRoutes },
  { path: "/documents", handler: documentsRoutes },
] as const;

routeRegistry.forEach(({ path, handler }) => {
  router.use(path, handler);
});

export default router;
