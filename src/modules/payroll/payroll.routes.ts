import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { payrollController } from "./payroll.controller.js";
import {
  validateCreatePayrollRunPayload,
  validateCreateSalaryStructurePayload,
  validateUpdateSalaryStructurePayload,
} from "./payroll.validation.js";

const payrollRoutes = Router();

payrollRoutes.get("/", payrollController.getOverview);
payrollRoutes.get("/run", payrollController.listPayrollRuns);
payrollRoutes.post(
  "/run",
  validationMiddleware(validateCreatePayrollRunPayload),
  payrollController.runPayroll,
);
payrollRoutes.get("/run/:runId", payrollController.getPayrollRun);
payrollRoutes.post(
  "/salary-structures",
  validationMiddleware(validateCreateSalaryStructurePayload),
  payrollController.createSalaryStructure,
);
payrollRoutes.patch(
  "/salary-structures/:structureId",
  validationMiddleware(validateUpdateSalaryStructurePayload),
  payrollController.updateSalaryStructure,
);

export default payrollRoutes;
