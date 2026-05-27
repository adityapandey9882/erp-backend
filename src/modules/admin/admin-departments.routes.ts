import { Router } from "express";
import { adminDepartmentsController } from "./admin-departments.controller.js";

const adminDepartmentsRoutes = Router();

adminDepartmentsRoutes.get("/", adminDepartmentsController.getWorkspace);

export default adminDepartmentsRoutes;
