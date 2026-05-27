import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  AssignAssetRequest,
  CreateAssetEventRequest,
  CreateAssetProcurementRequest,
  CreateAssetRequest,
  UpdateAssetStatusRequest,
  UpdateAssetRequest,
} from "./assets.types.js";
import { assetsService } from "./assets.service.js";

function readAssetIdParam(request: AuthenticatedRequest) {
  const value = request.params.assetId;

  return typeof value === "string" ? value.trim() : "";
}

function readProcurementIdParam(request: AuthenticatedRequest) {
  const value = request.params.procurementId;

  return typeof value === "string" ? value.trim() : "";
}

export const assetsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await assetsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listProcurements(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await assetsService.listProcurements(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getProcurement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const procurementId = readProcurementIdParam(request);

    if (!procurementId) {
      response.status(400).json({
        message: "A procurement identifier is required.",
      });
      return;
    }

    const result = await assetsService.getProcurement(request.auth, procurementId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createProcurement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await assetsService.createProcurement(
      request.auth,
      request.body as CreateAssetProcurementRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async createAssetsFromProcurement(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const procurementId = readProcurementIdParam(request);

    if (!procurementId) {
      response.status(400).json({
        message: "A procurement identifier is required.",
      });
      return;
    }

    const result = await assetsService.createAssetsFromProcurement(
      request.auth,
      procurementId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAsset(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await assetsService.createAsset(
      request.auth,
      request.body as CreateAssetRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async getAssetEvents(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.getAssetEvents(request.auth, assetId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateAsset(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.updateAsset(
      request.auth,
      assetId,
      request.body as UpdateAssetRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAssetEvent(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.createAssetEvent(
      request.auth,
      assetId,
      request.body as CreateAssetEventRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateAssetStatus(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.updateAssetStatus(
      request.auth,
      assetId,
      request.body as UpdateAssetStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async assignAsset(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.assignAsset(
      request.auth,
      assetId,
      request.body as AssignAssetRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async returnAsset(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.returnAsset(request.auth, assetId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getEmployeeAssetEvents(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({
        message: "An asset identifier is required.",
      });
      return;
    }

    const result = await assetsService.getEmployeeAssetEvents(
      request.auth,
      assetId,
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
