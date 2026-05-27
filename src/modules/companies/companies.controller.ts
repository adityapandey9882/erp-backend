import type { Response } from "express";
import { companiesService } from "./companies.service.js";
import type {
  AssignCompanyAdminRequest,
  CreateCompanyRequest,
  UpdateCompanyLogoRequest,
  UpdateCompanyModulesRequest,
  UpdateCompanyRequest,
  UpdateCompanyStatusRequest,
} from "./companies.types.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";

function readCompanyId(request: AuthenticatedRequest) {
  const value = request.params.companyId;

  return Array.isArray(value) ? value[0] ?? "" : value;
}

export const companiesController = {
  async list(_request: AuthenticatedRequest, response: Response) {
    response.status(200).json(await companiesService.getCompaniesWorkspace());
  },

  async detail(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.getCompanyDetail(readCompanyId(request));

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async create(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.createCompany(
      request.body as CreateCompanyRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async update(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.updateCompany(
      readCompanyId(request),
      request.body as UpdateCompanyRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateStatus(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.updateCompanyStatus(
      readCompanyId(request),
      request.body as UpdateCompanyStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async archive(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.archiveCompany(
      readCompanyId(request),
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async restore(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.restoreCompany(
      readCompanyId(request),
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateLogo(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.updateCompanyLogo(
      readCompanyId(request),
      request.body as UpdateCompanyLogoRequest,
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async remove(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.deleteCompany(
      readCompanyId(request),
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async assignAdmin(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.assignCompanyAdmin(
      readCompanyId(request),
      request.body as AssignCompanyAdminRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateModules(request: AuthenticatedRequest, response: Response) {
    const result = await companiesService.updateCompanyModules(
      readCompanyId(request),
      request.body as UpdateCompanyModulesRequest,
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
