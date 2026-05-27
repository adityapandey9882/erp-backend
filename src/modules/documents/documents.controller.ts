import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { documentsService } from "./documents.service.js";
import type {
  CreateDocumentFolderRequest,
  CreateDocumentShareRequest,
  UpdateDocumentFolderRequest,
  UpdateDocumentRequest,
} from "./documents.types.js";
import { validateCreateDocumentPayload } from "./documents.validation.js";
import type { DocumentUploadRequest } from "./documents.upload.js";

function readRouteParam(request: AuthenticatedRequest, key: string) {
  const value = request.params[key];

  return typeof value === "string" ? value.trim() : "";
}

function readOptionalQueryValue(request: AuthenticatedRequest, key: string) {
  const value = request.query[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function readOptionalIntegerQuery(request: AuthenticatedRequest, key: string) {
  const value = readOptionalQueryValue(request, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function readWorkspaceQuery(request: AuthenticatedRequest) {
  return {
    userId: readOptionalQueryValue(request, "userId"),
    tab: readOptionalQueryValue(request, "tab"),
    search: readOptionalQueryValue(request, "search"),
    documentType: readOptionalQueryValue(request, "documentType"),
    uploadedBy: readOptionalQueryValue(request, "uploadedBy"),
    fromDate: readOptionalQueryValue(request, "fromDate"),
    toDate: readOptionalQueryValue(request, "toDate"),
    folderId: readOptionalQueryValue(request, "folderId"),
    sortBy: readOptionalQueryValue(request, "sortBy"),
    sortOrder: readOptionalQueryValue(request, "sortOrder"),
    page: readOptionalIntegerQuery(request, "page"),
    limit: readOptionalIntegerQuery(request, "limit"),
  };
}

function setDocumentResponseHeaders(input: {
  response: Response;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  disposition: "attachment" | "inline";
}) {
  input.response.setHeader("Content-Type", input.mimeType);
  input.response.setHeader(
    "Content-Disposition",
    `${input.disposition}; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
  );
  input.response.setHeader("Cache-Control", "private, no-store, max-age=0");
  input.response.setHeader("X-Content-Type-Options", "nosniff");
  input.response.setHeader("Content-Length", String(input.sizeBytes));
}

export const documentsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await documentsService.getWorkspace(
      request.auth,
      readWorkspaceQuery(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getRecycleBin(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await documentsService.getWorkspace(request.auth, {
      ...readWorkspaceQuery(request),
      tab: "recycle",
    });

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listFolders(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await documentsService.listFolders(
      request.auth,
      readWorkspaceQuery(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createFolder(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await documentsService.createFolder(
      request.auth,
      request.body as CreateDocumentFolderRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateFolder(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const folderId = readRouteParam(request, "folderId");

    if (!folderId) {
      response.status(400).json({
        message: "A folder identifier is required.",
      });
      return;
    }

    const result = await documentsService.updateFolder(
      request.auth,
      folderId,
      request.body as UpdateDocumentFolderRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteFolder(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const folderId = readRouteParam(request, "folderId");

    if (!folderId) {
      response.status(400).json({
        message: "A folder identifier is required.",
      });
      return;
    }

    const result = await documentsService.deleteFolder(request.auth, folderId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const uploadRequest = request as AuthenticatedRequest & DocumentUploadRequest;
    const validationResult = validateCreateDocumentPayload(request.body, {
      originalName: uploadRequest.file?.originalname ?? null,
      mimeType: uploadRequest.file?.mimetype ?? null,
      sizeBytes: uploadRequest.file?.size ?? 0,
      buffer: uploadRequest.file?.buffer ?? Buffer.alloc(0),
    });

    if (!validationResult.success) {
      response.status(400).json({
        message: "Validation failed.",
        errors: validationResult.errors,
      });
      return;
    }

    const result = await documentsService.createDocument(
      request.auth,
      validationResult.data,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.updateDocument(
      request.auth,
      documentId,
      request.body as UpdateDocumentRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.deleteDocument(request.auth, documentId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async restoreDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.restoreDocument(request.auth, documentId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async permanentlyDeleteDocument(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.permanentlyDeleteDocument(
      request.auth,
      documentId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.getDocument(request.auth, documentId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listDocumentShares(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.listDocumentShares(
      request.auth,
      documentId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createDocumentShare(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.createDocumentShare(
      request.auth,
      documentId,
      request.body as CreateDocumentShareRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async revokeDocumentShare(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");
    const shareId = readRouteParam(request, "shareId");

    if (!documentId || !shareId) {
      response.status(400).json({
        message: "Document and share identifiers are required.",
      });
      return;
    }

    const result = await documentsService.revokeDocumentShare(
      request.auth,
      documentId,
      shareId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async downloadDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.getDocumentFile(
      request.auth,
      documentId,
      "download",
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    setDocumentResponseHeaders({
      response,
      fileName: result.data.fileName,
      mimeType: result.data.mimeType,
      sizeBytes: result.data.sizeBytes,
      disposition: "attachment",
    });
    response.status(200).send(result.data.buffer);
    void documentsService.recordDownload(request.auth, result.data.document);
  },

  async previewDocument(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const documentId = readRouteParam(request, "documentId");

    if (!documentId) {
      response.status(400).json({
        message: "A document identifier is required.",
      });
      return;
    }

    const result = await documentsService.getDocumentFile(
      request.auth,
      documentId,
      "preview",
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    setDocumentResponseHeaders({
      response,
      fileName: result.data.fileName,
      mimeType: result.data.mimeType,
      sizeBytes: result.data.sizeBytes,
      disposition: "inline",
    });
    response.status(200).send(result.data.buffer);
  },
};
