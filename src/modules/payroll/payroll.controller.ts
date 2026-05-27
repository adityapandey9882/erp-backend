import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  CreatePayrollRunRequest,
  CreateSalaryStructureRequest,
  UpdateSalaryStructureRequest,
} from "./payroll.types.js";
import { payrollService } from "./payroll.service.js";

function readStructureIdParam(request: AuthenticatedRequest) {
  const value = request.params.structureId;

  return typeof value === "string" ? value.trim() : "";
}

function readRunIdParam(request: AuthenticatedRequest) {
  const value = request.params.id ?? request.params.runId;

  return typeof value === "string" ? value.trim() : "";
}

export const payrollController = {
  async getOverview(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await payrollService.getOverview(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listPayrollRuns(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await payrollService.listPayrollRuns(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async runPayroll(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await payrollService.runPayroll(
      request.auth,
      request.body as CreatePayrollRunRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async getPayrollRun(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const runId = readRunIdParam(request);

    if (!runId) {
      response.status(400).json({
        message: "A payroll run identifier is required.",
      });
      return;
    }

    const result = await payrollService.getPayrollRun(request.auth, runId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createSalaryStructure(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await payrollService.createSalaryStructure(
      request.auth,
      request.body as CreateSalaryStructureRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateSalaryStructure(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const structureId = readStructureIdParam(request);

    if (!structureId) {
      response.status(400).json({
        message: "A salary structure identifier is required.",
      });
      return;
    }

    const result = await payrollService.updateSalaryStructure(
      request.auth,
      structureId,
      request.body as UpdateSalaryStructureRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
