import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/index.js";
import { documentsController } from "./documents.controller.js";
import { documentUploadMiddleware } from "./documents.upload.js";
import {
  validateCreateDocumentFolderPayload,
  validateCreateDocumentSharePayload,
  validateUpdateDocumentFolderPayload,
  validateUpdateDocumentPayload,
} from "./documents.validation.js";

const documentsRoutes = Router();

documentsRoutes.get("/", documentsController.getWorkspace);
documentsRoutes.get("/recycle-bin", documentsController.getRecycleBin);
documentsRoutes.get("/folders", documentsController.listFolders);
documentsRoutes.post(
  "/folders",
  validationMiddleware(validateCreateDocumentFolderPayload),
  documentsController.createFolder,
);
documentsRoutes.patch(
  "/folders/:folderId",
  validationMiddleware(validateUpdateDocumentFolderPayload),
  documentsController.updateFolder,
);
documentsRoutes.delete("/folders/:folderId", documentsController.deleteFolder);

documentsRoutes.post(
  "/",
  documentUploadMiddleware,
  documentsController.createDocument,
);
documentsRoutes.patch(
  "/:documentId",
  validationMiddleware(validateUpdateDocumentPayload),
  documentsController.updateDocument,
);
documentsRoutes.delete("/:documentId", documentsController.deleteDocument);
documentsRoutes.post("/:documentId/restore", documentsController.restoreDocument);
documentsRoutes.delete(
  "/:documentId/permanent",
  documentsController.permanentlyDeleteDocument,
);
documentsRoutes.get("/:documentId/shares", documentsController.listDocumentShares);
documentsRoutes.post(
  "/:documentId/share",
  validationMiddleware(validateCreateDocumentSharePayload),
  documentsController.createDocumentShare,
);
documentsRoutes.delete(
  "/:documentId/share/:shareId",
  documentsController.revokeDocumentShare,
);
documentsRoutes.get("/:documentId/download", documentsController.downloadDocument);
documentsRoutes.get("/:documentId/preview", documentsController.previewDocument);
documentsRoutes.get("/:documentId", documentsController.getDocument);

export default documentsRoutes;
