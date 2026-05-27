import { Router } from "express";
import { adminDesignationsController } from "./admin-designations.controller.js";

const adminDesignationsRoutes = Router();

adminDesignationsRoutes.get("/", adminDesignationsController.getWorkspace);

export default adminDesignationsRoutes;
