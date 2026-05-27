import { Router } from "express";
import {
  adminLeaveManagementController,
  validateAdminLeaveStatusUpdate,
} from "./admin-leave-management.controller.js";

const adminLeaveManagementRoutes = Router();

adminLeaveManagementRoutes.get("/", adminLeaveManagementController.getWorkspace);
adminLeaveManagementRoutes.patch(
  "/:leaveId/status",
  validateAdminLeaveStatusUpdate,
  adminLeaveManagementController.updateLeaveStatus,
);

export default adminLeaveManagementRoutes;
