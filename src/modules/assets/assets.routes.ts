import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { assetsController } from "./assets.controller.js";
import {
  validateAssignAssetPayload,
  validateCreateAssetEventPayload,
  validateCreateAssetPayload,
  validateCreateAssetProcurementPayload,
  validateUpdateAssetPayload,
  validateUpdateAssetStatusPayload,
} from "./assets.validation.js";

const assetsModuleRoutes = Router();

assetsModuleRoutes.get("/", assetsController.getWorkspace);
assetsModuleRoutes.get("/procurement", assetsController.listProcurements);
assetsModuleRoutes.post(
  "/procurement",
  validationMiddleware(validateCreateAssetProcurementPayload),
  assetsController.createProcurement,
);
assetsModuleRoutes.get(
  "/procurement/:procurementId",
  assetsController.getProcurement,
);
assetsModuleRoutes.post(
  "/procurement/:procurementId/create-assets",
  assetsController.createAssetsFromProcurement,
);
assetsModuleRoutes.post(
  "/",
  validationMiddleware(validateCreateAssetPayload),
  assetsController.createAsset,
);
assetsModuleRoutes.get("/:assetId/events", assetsController.getAssetEvents);
assetsModuleRoutes.post(
  "/:assetId/events",
  validationMiddleware(validateCreateAssetEventPayload),
  assetsController.createAssetEvent,
);
assetsModuleRoutes.patch(
  "/:assetId",
  validationMiddleware(validateUpdateAssetPayload),
  assetsController.updateAsset,
);
assetsModuleRoutes.patch(
  "/:assetId/status",
  validationMiddleware(validateUpdateAssetStatusPayload),
  assetsController.updateAssetStatus,
);
assetsModuleRoutes.post(
  "/:assetId/assign",
  validationMiddleware(validateAssignAssetPayload),
  assetsController.assignAsset,
);
assetsModuleRoutes.post("/:assetId/return", assetsController.returnAsset);

export default assetsModuleRoutes;
