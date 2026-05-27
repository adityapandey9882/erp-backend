import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database/index.js";
import { auditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import type { AppRole } from "../roles/roles.types.js";
import { usersRepository } from "../users/users.repository.js";
import { documentsRepository } from "./documents.repository.js";
import {
  deleteStoredDocumentFile,
  readStoredDocumentFile,
  storeDocumentFile,
} from "./documents.storage.js";
import type {
  CreateDocumentFolderRequest,
  CreateDocumentRequest,
  CreateDocumentShareRequest,
  DocumentFolderMutationResponse,
  DocumentFolderRecord,
  DocumentLookupResponse,
  DocumentMutationResponse,
  DocumentRecord,
  DocumentsServiceResult,
  DocumentsWorkspaceResponse,
  DocumentsWorkspaceTab,
  DocumentShareMutationResponse,
  DocumentSharesResponse,
  DocumentSortBy,
  DocumentSortOrder,
  UpdateDocumentFolderRequest,
  UpdateDocumentRequest,
} from "./documents.types.js";

const DEFAULT_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

type DocumentsWorkspaceQuery = {
  userId?: string | null;
  tab?: string | null;
  search?: string | null;
  documentType?: string | null;
  uploadedBy?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  folderId?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  page?: number | null;
  limit?: number | null;
};

function ok<T>(data: T): DocumentsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): DocumentsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function buildUserSummary(
  user: Pick<AuthenticatedUser, "id" | "fullName" | "email" | "role">,
) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email.toLowerCase(),
    role: user.role,
  };
}

function normalizeNullableText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function parseDataUrl(fileUrl: string) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(fileUrl);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function resolveDownloadFileName(document: DocumentRecord, sourceUrl?: string) {
  const explicitFileName = normalizeNullableText(document.fileName);

  if (explicitFileName) {
    return explicitFileName;
  }

  if (sourceUrl) {
    try {
      const parsedUrl = new URL(sourceUrl);
      const lastSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";

      if (lastSegment) {
        return decodeURIComponent(lastSegment);
      }
    } catch {
      // Ignore parse failures and fall back to the document name.
    }
  }

  return document.name;
}


async function resolveCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function isDocumentsManager(user: AuthenticatedUser) {
  return user.role === "admin" || user.role === "hr";
}

function resolveWorkspaceTab(
  user: AuthenticatedUser,
  requestedTab?: string | null,
): DocumentsWorkspaceTab {
  if (requestedTab === "shared" || requestedTab === "recycle" || requestedTab === "my") {
    if (user.role === "employee") {
      return requestedTab;
    }

    return requestedTab === "recycle" ? "recycle" : "my";
  }

  return user.role === "employee" ? "my" : "my";
}

function resolveSortBy(value?: string | null): DocumentSortBy {
  if (value === "name" || value === "downloadCount" || value === "createdAt") {
    return value;
  }

  return "createdAt";
}

function resolveSortOrder(
  sortBy: DocumentSortBy,
  sortOrder?: string | null,
  rawSortBy?: string | null,
): DocumentSortOrder {
  if (sortOrder === "asc" || sortOrder === "desc") {
    return sortOrder;
  }

  if (rawSortBy === "oldest") {
    return "asc";
  }

  if (rawSortBy === "name-desc") {
    return "desc";
  }

  if (rawSortBy === "name" && sortBy === "name") {
    return "asc";
  }

  return "desc";
}

function resolveQueryPage(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(Math.round(value), 1);
}

function resolveQueryLimit(user: AuthenticatedUser, value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return user.role === "employee" ? 10 : null;
  }

  return Math.min(Math.max(Math.round(value), 1), 100);
}

function buildDocumentAccessRecord(
  user: AuthenticatedUser,
  document: DocumentRecord,
): DocumentRecord {
  const isEmployee = user.role === "employee";
  const isOwnDocument = document.userId === user.id;
  const canViewSharedDocument = document.isCompanyWide || document.sharePermission !== null;
  const sharedWithMe = isEmployee && !isOwnDocument && canViewSharedDocument;
  const canDownloadSharedDocument =
    document.isCompanyWide ||
    document.sharePermission === "download" ||
    document.sharePermission === "manage";

  return {
    ...document,
    sharedWithMe,
    canDownload: isEmployee
      ? isOwnDocument
        ? true
        : canDownloadSharedDocument
      : true,
    canEdit: isEmployee ? isOwnDocument && document.deletedAt === null : document.deletedAt === null,
    canDelete: isEmployee ? isOwnDocument && document.deletedAt === null : document.deletedAt === null,
    canRestore: isEmployee ? isOwnDocument && document.deletedAt !== null : document.deletedAt !== null,
  };
}

function canUserViewDocument(user: AuthenticatedUser, document: DocumentRecord) {
  if (user.role !== "employee") {
    return true;
  }

  return (
    document.userId === user.id ||
    document.isCompanyWide ||
    document.sharePermission !== null
  );
}

function buildStorageSnapshot(input: {
  usedBytes: number;
  companyQuotaBytes: number | null;
  userQuotaBytes: number | null;
}) {
  const quotaBytes =
    input.userQuotaBytes ?? input.companyQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES;
  const isQuotaConfigured =
    input.userQuotaBytes !== null ||
    (input.companyQuotaBytes !== null &&
      input.companyQuotaBytes !== DEFAULT_STORAGE_QUOTA_BYTES);

  return {
    usedBytes: input.usedBytes,
    quotaBytes,
    availableBytes: Math.max(quotaBytes - input.usedBytes, 0),
    isQuotaConfigured,
  };
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string };

  return candidate.code === "23505";
}

async function resolveFilterUserId(
  user: AuthenticatedUser,
  companyId: string,
  requestedUserId?: string | null,
) {
  const normalizedUserId = normalizeNullableText(requestedUserId);

  if (user.role === "employee") {
    if (normalizedUserId && normalizedUserId !== user.id) {
      return fail<string | null>(
        403,
        "Employee document access is limited to your own documents.",
      );
    }

    return ok(user.id);
  }

  if (!normalizedUserId) {
    return ok<string | null>(null);
  }

  const targetUser = await usersRepository.findCompanyUserProfileById(
    companyId,
    normalizedUserId,
  );

  if (!targetUser) {
    return fail<string | null>(404, "Selected user not found in the company.");
  }

  return ok<string | null>(targetUser.id);
}

async function resolveFolderForWrite(
  user: AuthenticatedUser,
  companyId: string,
  folderId: string | null | undefined,
) {
  if (folderId === undefined) {
    return ok<DocumentFolderRecord | null>(null);
  }

  if (folderId === null) {
    return ok<DocumentFolderRecord | null>(null);
  }

  const normalizedFolderId = normalizeNullableText(folderId);

  if (!normalizedFolderId) {
    return ok<DocumentFolderRecord | null>(null);
  }

  const folder = await documentsRepository.findFolderById(companyId, normalizedFolderId);

  if (!folder || folder.deletedAt) {
    return fail<DocumentFolderRecord | null>(404, "Folder not found.");
  }

  if (user.role === "employee") {
    if (folder.folderScope !== "personal" || folder.userId !== user.id) {
      return fail<DocumentFolderRecord | null>(
        403,
        "Employees can only use their own personal folders.",
      );
    }
  } else if (!isDocumentsManager(user)) {
    return fail<DocumentFolderRecord | null>(
      403,
      "This account cannot manage company folders.",
    );
  } else if (folder.folderScope !== "company" || folder.userId !== null) {
    return fail<DocumentFolderRecord | null>(
      403,
      "HR and admin users can only assign company folders from this workspace.",
    );
  }

  return ok(folder);
}

async function resolveParentFolderForWrite(
  user: AuthenticatedUser,
  companyId: string,
  parentFolderId: string | null | undefined,
  expectedScope: "personal" | "company",
) {
  if (parentFolderId === undefined) {
    return ok<DocumentFolderRecord | null>(null);
  }

  const normalizedParentFolderId = normalizeNullableText(parentFolderId);

  if (!normalizedParentFolderId) {
    return ok<DocumentFolderRecord | null>(null);
  }

  const folder = await documentsRepository.findFolderById(
    companyId,
    normalizedParentFolderId,
  );

  if (!folder || folder.deletedAt) {
    return fail<DocumentFolderRecord | null>(404, "Parent folder not found.");
  }

  if (folder.folderScope !== expectedScope) {
    return fail<DocumentFolderRecord | null>(
      403,
      "Folder nesting must stay within the same folder scope.",
    );
  }

  if (expectedScope === "personal" && folder.userId !== user.id) {
    return fail<DocumentFolderRecord | null>(
      403,
      "Employees can only organize folders inside their own personal folders.",
    );
  }

  if (expectedScope === "company" && folder.userId !== null) {
    return fail<DocumentFolderRecord | null>(
      403,
      "Company folders can only be nested inside other company folders.",
    );
  }

  return ok(folder);
}

async function getDocumentForAccess(
  user: AuthenticatedUser,
  companyId: string,
  documentId: string,
) {
  const document = await documentsRepository.findDocumentById(
    companyId,
    documentId,
    user.id,
    user.role,
  );

  if (!document) {
    return fail<DocumentRecord>(404, "Document not found.");
  }

  if (!canUserViewDocument(user, document)) {
    return fail<DocumentRecord>(404, "Document not found.");
  }

  return ok(buildDocumentAccessRecord(user, document));
}

export const documentsService = {
  async getWorkspace(
    user: AuthenticatedUser,
    query: DocumentsWorkspaceQuery = {},
  ): Promise<DocumentsServiceResult<DocumentsWorkspaceResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const filterUserIdResult = await resolveFilterUserId(
      user,
      companyId,
      query.userId,
    );

    if (!filterUserIdResult.ok) {
      return filterUserIdResult;
    }

    const activeFilterUserId = filterUserIdResult.data;
    const activeTab = resolveWorkspaceTab(user, query.tab);
    const sortBy = resolveSortBy(query.sortBy);
    const sortOrder = resolveSortOrder(sortBy, query.sortOrder, query.sortBy);
    const page = resolveQueryPage(query.page);
    const limit = resolveQueryLimit(user, query.limit);
    const requestArgs = {
      companyId,
      role: user.role,
      requestUserId: user.id,
      requestUserRole: user.role,
      filterUserId: activeFilterUserId,
      tab: activeTab,
      search: normalizeNullableText(query.search),
      documentType: normalizeNullableText(query.documentType),
      uploadedBy: normalizeNullableText(query.uploadedBy),
      fromDate: normalizeNullableText(query.fromDate),
      toDate: normalizeNullableText(query.toDate),
      folderId: normalizeNullableText(query.folderId),
      sortBy,
      sortOrder,
      page,
      limit,
    } as const;

    const [companyUsers, companySummary, listResult, visibleAggregate, folders, filterOptions, quota] =
      await Promise.all([
        usersRepository.listCompanyUserProfiles(companyId),
        documentsRepository.getCompanySummary(companyId),
        documentsRepository.listDocumentsForWorkspace(requestArgs),
        documentsRepository.aggregateDocuments(requestArgs),
        documentsRepository.listFolderRecords(requestArgs),
        documentsRepository.listFilterOptions(requestArgs),
        documentsRepository.resolveQuota(
          companyId,
          user.role === "employee" ? user.id : activeFilterUserId,
        ),
      ]);

    const [myMetrics, sharedMetrics, recycleMetrics] =
      user.role === "employee"
        ? await Promise.all([
            documentsRepository.aggregateDocuments({
              ...requestArgs,
              tab: "my",
              folderId: null,
              page: 1,
              limit: null,
            }),
            documentsRepository.aggregateDocuments({
              ...requestArgs,
              tab: "shared",
              folderId: null,
              page: 1,
              limit: null,
            }),
            documentsRepository.aggregateDocuments({
              ...requestArgs,
              tab: "recycle",
              folderId: null,
              page: 1,
              limit: null,
            }),
          ])
        : [
            { totalItems: visibleAggregate.totalItems, totalDownloads: visibleAggregate.totalDownloads, totalSizeBytes: visibleAggregate.totalSizeBytes },
            { totalItems: 0, totalDownloads: 0, totalSizeBytes: 0 },
            { totalItems: 0, totalDownloads: 0, totalSizeBytes: 0 },
          ];

    const documents = listResult.documents.map((document) =>
      buildDocumentAccessRecord(user, document),
    );
    const availableUsers =
      user.role === "employee"
        ? [buildUserSummary(user)]
        : companyUsers.map((candidate) =>
            buildUserSummary({
              id: candidate.id,
              fullName: candidate.fullName,
              email: candidate.email,
              role: candidate.role,
            }),
          );

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      summary: {
        ...companySummary,
        visibleDocuments: visibleAggregate.totalItems,
        myDocuments: myMetrics.totalItems,
        sharedDocuments: sharedMetrics.totalItems,
        recycleBinDocuments: recycleMetrics.totalItems,
        visibleDownloadCount: visibleAggregate.totalDownloads,
      },
      activeFilter: {
        userId: activeFilterUserId,
        tab: activeTab,
        search: normalizeNullableText(query.search) ?? "",
        documentType: normalizeNullableText(query.documentType),
        uploadedBy: normalizeNullableText(query.uploadedBy),
        fromDate: normalizeNullableText(query.fromDate),
        toDate: normalizeNullableText(query.toDate),
        folderId: normalizeNullableText(query.folderId),
        sortBy,
        sortOrder,
        page,
        limit,
      },
      pagination: {
        page: listResult.page,
        limit: listResult.limit,
        totalItems: listResult.totalItems,
        totalPages: listResult.totalPages,
      },
      availableUsers,
      folders,
      filterOptions,
      documents,
      myDocuments: activeTab === "my" ? documents : [],
      sharedDocuments: activeTab === "shared" ? documents : [],
      storage: buildStorageSnapshot({
        usedBytes: visibleAggregate.totalSizeBytes,
        companyQuotaBytes: quota.companyQuotaBytes,
        userQuotaBytes:
          user.role === "employee" ? quota.userQuotaBytes : quota.userQuotaBytes,
      }),
    });
  },

  async createDocument(
    user: AuthenticatedUser,
    input: CreateDocumentRequest,
  ): Promise<DocumentsServiceResult<DocumentMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    let targetUserId: string | null = null;
    let isCompanyWide = Boolean(input.isCompanyWide);

    if (user.role === "employee") {
      if (input.userId && input.userId !== user.id) {
        return fail(
          403,
          "Employee document uploads can only be linked to your own account.",
        );
      }

      targetUserId = user.id;
      isCompanyWide = false;
    } else if (input.userId) {
      const targetUser = await usersRepository.findCompanyUserProfileById(
        companyId,
        input.userId,
      );

      if (!targetUser) {
        return fail(404, "Target user not found in the company.");
      }

      targetUserId = targetUser.id;
      isCompanyWide = false;
    } else if (!isDocumentsManager(user)) {
      return fail(403, "This account cannot upload company documents.");
    } else {
      isCompanyWide = true;
    }

    const folderResult = await resolveFolderForWrite(
      user,
      companyId,
      input.folderId ?? null,
    );

    if (!folderResult.ok) {
      return folderResult;
    }

    const folder = folderResult.data;
    const quotaSubjectUserId =
      targetUserId && folder?.folderScope === "personal" ? targetUserId : targetUserId;
    const quota = await documentsRepository.resolveQuota(companyId, quotaSubjectUserId);
    const quotaBytes =
      quota.userQuotaBytes ?? quota.companyQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES;
    const quotaIsUserScoped = quota.userQuotaBytes !== null && targetUserId !== null;
    const storageAggregate = await documentsRepository.aggregateDocuments(
      quotaIsUserScoped
        ? {
            companyId,
            role: "admin",
            requestUserId: user.id,
            requestUserRole: user.role,
            filterUserId: targetUserId,
            tab: "my",
            page: 1,
            limit: null,
          }
        : {
            companyId,
            role: "admin",
            requestUserId: user.id,
            requestUserRole: user.role,
            filterUserId: null,
            tab: "my",
            page: 1,
            limit: null,
          },
    );
    const nextDocumentSize =
      typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes)
        ? Math.max(Math.round(input.sizeBytes), 0)
        : input.fileBuffer.length;

    if (quotaBytes !== null && storageAggregate.totalSizeBytes + nextDocumentSize > quotaBytes) {
      return fail(409, "Document storage quota has been reached for this scope.");
    }

    const documentId = randomUUID();
    let storedFile: Awaited<ReturnType<typeof storeDocumentFile>>;

    try {
      storedFile = await storeDocumentFile({
        companyId,
        documentId,
        userId: targetUserId,
        isCompanyWide,
        fileName: input.fileName,
        fileMimeType: input.fileMimeType,
        fileBuffer: input.fileBuffer,
      });
    } catch {
      return fail(409, "Unable to store the uploaded document file right now.");
    }

    const createdDocumentId = await documentsRepository.createDocument({
      id: documentId,
      companyId,
      userId: targetUserId,
      folderId: folder?.id ?? null,
      isCompanyWide,
      name: input.name,
      type: input.type,
      description: normalizeNullableText(input.description),
      fileUrl: storedFile.storageReference,
      fileName: normalizeNullableText(input.fileName),
      mimeType: normalizeNullableText(input.fileMimeType)?.toLowerCase() ?? null,
      sizeBytes: nextDocumentSize,
      uploadedBy: user.id,
    });

    if (!createdDocumentId) {
      return fail(409, "Unable to create the document record.");
    }

    const createdDocumentResult = await getDocumentForAccess(
      user,
      companyId,
      createdDocumentId,
    );

    if (!createdDocumentResult.ok) {
      return createdDocumentResult;
    }

    void auditService.recordAction(user, {
      action: "document.uploaded",
      entityType: "document",
      entityId: createdDocumentId,
      metadata: {
        document: {
          id: createdDocumentId,
          name: input.name,
          type: input.type,
          userId: targetUserId,
          folderId: folder?.id ?? null,
          isCompanyWide,
          sizeBytes: nextDocumentSize,
        },
        storage: storedFile.storageMethod,
      },
    });

    return ok({
      message: "Document uploaded successfully.",
      document: createdDocumentResult.data,
    });
  },

  async getDocument(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DocumentsServiceResult<DocumentLookupResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    if (documentResult.data.deletedAt !== null) {
      return fail(404, "Document not found.");
    }

    return ok({
      document: documentResult.data,
    });
  },

  async updateDocument(
    user: AuthenticatedUser,
    documentId: string,
    input: UpdateDocumentRequest,
  ): Promise<DocumentsServiceResult<DocumentMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    const document = documentResult.data;

    if (document.deletedAt !== null) {
      return fail(409, "Deleted documents cannot be updated.");
    }

    if (user.role === "employee" && document.userId !== user.id) {
      return fail(403, "Employees can only rename or move their own documents.");
    }

    const folderResult =
      input.folderId !== undefined
        ? await resolveFolderForWrite(user, companyId, input.folderId)
        : ok<DocumentFolderRecord | null>(null);

    if (!folderResult.ok) {
      return folderResult;
    }

    const updated = await documentsRepository.updateDocument({
      companyId,
      documentId,
      name: input.name?.trim() || undefined,
      type: input.type?.trim() || undefined,
      folderId:
        input.folderId !== undefined
          ? folderResult.data?.id ?? null
          : undefined,
    });

    if (!updated) {
      return fail(409, "No document changes were applied.");
    }

    const updatedDocumentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!updatedDocumentResult.ok) {
      return updatedDocumentResult;
    }

    void auditService.recordAction(user, {
      action: "document.updated",
      entityType: "document",
      entityId: documentId,
      metadata: {
        document: {
          id: documentId,
          name: input.name ?? document.name,
          type: input.type ?? document.type,
          folderId:
            input.folderId !== undefined
              ? folderResult.data?.id ?? null
              : document.folderId,
        },
      },
    });

    return ok({
      message: "Document updated successfully.",
      document: updatedDocumentResult.data,
    });
  },

  async deleteDocument(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DocumentsServiceResult<{ message: string }>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    const document = documentResult.data;

    if (document.deletedAt !== null) {
      return fail(409, "Document is already in the recycle bin.");
    }

    if (user.role === "employee" && document.userId !== user.id) {
      return fail(403, "Employees can delete only their own documents.");
    }

    const deleted = await documentsRepository.softDeleteDocument(
      companyId,
      documentId,
      user.id,
    );

    if (!deleted) {
      return fail(409, "Unable to move the document to the recycle bin.");
    }

    void auditService.recordAction(user, {
      action: "document.deleted",
      entityType: "document",
      entityId: documentId,
      metadata: {
        document: {
          id: documentId,
          name: document.name,
          type: document.type,
        },
      },
    });

    return ok({
      message: "Document moved to the recycle bin.",
    });
  },

  async restoreDocument(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DocumentsServiceResult<DocumentMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    const document = documentResult.data;

    if (document.deletedAt === null) {
      return fail(409, "Document is not currently in the recycle bin.");
    }

    if (user.role === "employee" && document.userId !== user.id) {
      return fail(403, "Employees can restore only their own documents.");
    }

    const restored = await documentsRepository.restoreDocument(companyId, documentId);

    if (!restored) {
      return fail(409, "Unable to restore the document.");
    }

    const restoredDocumentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!restoredDocumentResult.ok) {
      return restoredDocumentResult;
    }

    void auditService.recordAction(user, {
      action: "document.restored",
      entityType: "document",
      entityId: documentId,
      metadata: {
        document: {
          id: documentId,
          name: document.name,
          type: document.type,
        },
      },
    });

    return ok({
      message: "Document restored successfully.",
      document: restoredDocumentResult.data,
    });
  },

  async permanentlyDeleteDocument(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DocumentsServiceResult<{ message: string }>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    const document = documentResult.data;

    if (document.deletedAt === null) {
      return fail(409, "Only documents in the recycle bin can be permanently deleted.");
    }

    if (user.role === "employee" && document.userId !== user.id) {
      return fail(403, "Employees can permanently delete only their own documents.");
    }

    const deletedPermanently = await documentsRepository.permanentlyDeleteDocument(
      companyId,
      documentId,
    );

    if (!deletedPermanently) {
      return fail(409, "Unable to permanently delete the document.");
    }

    try {
      await deleteStoredDocumentFile(document.fileUrl);
    } catch (error) {
      console.error("Failed to delete stored document file after permanent delete.", {
        documentId,
        companyId,
        storageReference: document.fileUrl,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    void auditService.recordAction(user, {
      action: "document.permanently-deleted",
      entityType: "document",
      entityId: documentId,
      metadata: {
        document: {
          id: documentId,
          name: document.name,
          type: document.type,
        },
      },
    });

    return ok({
      message: "Document permanently deleted.",
    });
  },

  async getDocumentFile(
    user: AuthenticatedUser,
    documentId: string,
    mode: "download" | "preview",
  ): Promise<
    DocumentsServiceResult<{
      document: DocumentRecord;
      fileName: string;
      mimeType: string;
      buffer: Buffer;
      sizeBytes: number;
    }>
  > {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const documentResult = await getDocumentForAccess(user, companyId, documentId);

    if (!documentResult.ok) {
      return documentResult;
    }

    const document = documentResult.data;

    if (document.deletedAt !== null) {
      return fail(404, "Document not found.");
    }

    if (mode === "download" && !document.canDownload) {
      return fail(403, "This document is view-only for the current session.");
    }

    const trimmedFileUrl = document.fileUrl.trim();
    const parsedDataUrl = parseDataUrl(trimmedFileUrl);

    if (parsedDataUrl) {
      return ok({
        document,
        fileName: resolveDownloadFileName(document),
        mimeType: document.mimeType ?? parsedDataUrl.mimeType,
        buffer: parsedDataUrl.buffer,
        sizeBytes: document.sizeBytes ?? parsedDataUrl.buffer.length,
      });
    }

    try {
      const storedFile = await readStoredDocumentFile(trimmedFileUrl);

      return ok({
        document,
        fileName: resolveDownloadFileName(document, storedFile.sourceUrl),
        mimeType:
          document.mimeType ??
          storedFile.mimeType ??
          "application/octet-stream",
        buffer: storedFile.buffer,
        sizeBytes: document.sizeBytes ?? storedFile.buffer.length,
      });
    } catch {
      return fail(409, "The stored document file could not be opened right now.");
    }
  },

  async recordDownload(user: AuthenticatedUser, document: DocumentRecord) {
    await documentsRepository.incrementDownloadCount(document.companyId, document.id);

    void auditService.recordAction(user, {
      companyId: document.companyId,
      action: "document.downloaded",
      entityType: "document",
      entityId: document.id,
      metadata: {
        document: {
          id: document.id,
          name: document.name,
          type: document.type,
          sharedWithMe: document.sharedWithMe,
        },
      },
    });
  },

  async listFolders(
    user: AuthenticatedUser,
    query: Pick<DocumentsWorkspaceQuery, "userId" | "tab" | "search" | "documentType" | "uploadedBy" | "fromDate" | "toDate"> = {},
  ): Promise<DocumentsServiceResult<{ folders: DocumentFolderRecord[] }>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const filterUserIdResult = await resolveFilterUserId(
      user,
      companyId,
      query.userId,
    );

    if (!filterUserIdResult.ok) {
      return filterUserIdResult;
    }

    const folders = await documentsRepository.listFolderRecords({
      companyId,
      role: user.role,
      requestUserId: user.id,
      requestUserRole: user.role,
      filterUserId: filterUserIdResult.data,
      tab: resolveWorkspaceTab(user, query.tab),
      search: normalizeNullableText(query.search),
      documentType: normalizeNullableText(query.documentType),
      uploadedBy: normalizeNullableText(query.uploadedBy),
      fromDate: normalizeNullableText(query.fromDate),
      toDate: normalizeNullableText(query.toDate),
      page: 1,
      limit: null,
    });

    return ok({ folders });
  },

  async createFolder(
    user: AuthenticatedUser,
    input: CreateDocumentFolderRequest,
  ): Promise<DocumentsServiceResult<DocumentFolderMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const folderScope = user.role === "employee" ? "personal" : input.folderScope ?? "company";

    if (user.role === "employee" && folderScope !== "personal") {
      return fail(403, "Employees can create personal folders only.");
    }

    if (user.role !== "employee" && !isDocumentsManager(user)) {
      return fail(403, "This account cannot create document folders.");
    }

    if (user.role !== "employee" && folderScope !== "company") {
      return fail(403, "HR and admin users can create company folders only.");
    }

    const parentFolderResult = await resolveParentFolderForWrite(
      user,
      companyId,
      input.parentFolderId,
      folderScope,
    );

    if (!parentFolderResult.ok) {
      return parentFolderResult;
    }

    try {
      const folderId = await documentsRepository.createFolder({
        id: randomUUID(),
        companyId,
        userId: folderScope === "personal" ? user.id : null,
        parentFolderId: parentFolderResult.data?.id ?? null,
        folderScope,
        name: input.name.trim(),
        isSystem: false,
        createdBy: user.id,
        updatedBy: user.id,
      });

      if (!folderId) {
        return fail(409, "Unable to create the folder.");
      }

      const folder = await documentsRepository.findFolderById(companyId, folderId);

      if (!folder) {
        return fail(404, "Folder not found.");
      }

      void auditService.recordAction(user, {
        action: "document-folder.created",
        entityType: "document-folder",
        entityId: folderId,
        metadata: {
          folder: {
            id: folderId,
            name: folder.name,
            scope: folder.folderScope,
          },
        },
      });

      return ok({
        message: "Folder created successfully.",
        folder,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A folder with this name already exists in the selected scope.");
      }

      throw error;
    }
  },

  async updateFolder(
    user: AuthenticatedUser,
    folderId: string,
    input: UpdateDocumentFolderRequest,
  ): Promise<DocumentsServiceResult<DocumentFolderMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const folder = await documentsRepository.findFolderById(companyId, folderId);

    if (!folder || folder.deletedAt) {
      return fail(404, "Folder not found.");
    }

    if (folder.isSystem) {
      return fail(403, "System folders cannot be modified.");
    }

    if (user.role === "employee") {
      if (folder.folderScope !== "personal" || folder.userId !== user.id) {
        return fail(403, "Employees can edit only their own personal folders.");
      }
    } else if (!isDocumentsManager(user) || folder.folderScope !== "company") {
      return fail(403, "This account cannot edit the selected folder.");
    }

    const parentFolderResult =
      input.parentFolderId !== undefined
        ? await resolveParentFolderForWrite(
            user,
            companyId,
            input.parentFolderId,
            folder.folderScope,
          )
        : ok<DocumentFolderRecord | null>(null);

    if (!parentFolderResult.ok) {
      return parentFolderResult;
    }

    if (parentFolderResult.data?.id === folder.id) {
      return fail(400, "A folder cannot be nested inside itself.");
    }

    try {
      const updated = await documentsRepository.updateFolder({
        companyId,
        folderId,
        name: input.name?.trim() || undefined,
        parentFolderId:
          input.parentFolderId !== undefined
            ? parentFolderResult.data?.id ?? null
            : undefined,
        updatedBy: user.id,
      });

      if (!updated) {
        return fail(409, "No folder changes were applied.");
      }

      const updatedFolder = await documentsRepository.findFolderById(companyId, folderId);

      if (!updatedFolder) {
        return fail(404, "Folder not found.");
      }

      void auditService.recordAction(user, {
        action: "document-folder.updated",
        entityType: "document-folder",
        entityId: folderId,
        metadata: {
          folder: {
            id: folderId,
            name: updatedFolder.name,
            parentFolderId: updatedFolder.parentFolderId,
          },
        },
      });

      return ok({
        message: "Folder updated successfully.",
        folder: updatedFolder,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A folder with this name already exists in the selected scope.");
      }

      throw error;
    }
  },

  async deleteFolder(
    user: AuthenticatedUser,
    folderId: string,
  ): Promise<DocumentsServiceResult<{ message: string }>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const folder = await documentsRepository.findFolderById(companyId, folderId);

    if (!folder || folder.deletedAt) {
      return fail(404, "Folder not found.");
    }

    if (folder.isSystem) {
      return fail(403, "System folders cannot be deleted.");
    }

    if (user.role === "employee") {
      if (folder.folderScope !== "personal" || folder.userId !== user.id) {
        return fail(403, "Employees can delete only their own personal folders.");
      }
    } else if (!isDocumentsManager(user) || folder.folderScope !== "company") {
      return fail(403, "This account cannot delete the selected folder.");
    }

    const activeDocumentCount = await documentsRepository.countActiveDocumentsInFolder(
      companyId,
      folderId,
    );

    if (activeDocumentCount > 0) {
      return fail(409, "Move or delete the documents in this folder before deleting it.");
    }

    await withTransaction(async (executor) => {
      await documentsRepository.detachChildFolders(companyId, folderId, user.id, executor);
      await documentsRepository.softDeleteFolder(companyId, folderId, user.id, executor);
    });

    void auditService.recordAction(user, {
      action: "document-folder.deleted",
      entityType: "document-folder",
      entityId: folderId,
      metadata: {
        folder: {
          id: folderId,
          name: folder.name,
        },
      },
    });

    return ok({
      message: "Folder deleted successfully.",
    });
  },

  async listDocumentShares(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DocumentsServiceResult<DocumentSharesResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!isDocumentsManager(user)) {
      return fail(403, "This account cannot inspect document shares.");
    }

    const document = await documentsRepository.findDocumentById(
      companyId,
      documentId,
      user.id,
      user.role,
    );

    if (!document) {
      return fail(404, "Document not found.");
    }

    const shares = await documentsRepository.listDocumentShares(companyId, documentId);

    return ok({ shares });
  },

  async createDocumentShare(
    user: AuthenticatedUser,
    documentId: string,
    input: CreateDocumentShareRequest,
  ): Promise<DocumentsServiceResult<DocumentShareMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!isDocumentsManager(user)) {
      return fail(403, "This account cannot share documents.");
    }

    const document = await documentsRepository.findDocumentById(
      companyId,
      documentId,
      user.id,
      user.role,
    );

    if (!document || document.deletedAt !== null) {
      return fail(404, "Document not found.");
    }

    const sharedWithUserId = normalizeNullableText(input.sharedWithUserId);
    const sharedWithRole = input.sharedWithRole ?? null;

    if (!sharedWithUserId && !sharedWithRole) {
      return fail(400, "Select a target user or role for sharing.");
    }

    if (sharedWithUserId && sharedWithRole) {
      return fail(400, "Choose either a target user or a target role, not both.");
    }

    if (sharedWithUserId) {
      const targetUser = await usersRepository.findCompanyUserProfileById(
        companyId,
        sharedWithUserId,
      );

      if (!targetUser) {
        return fail(404, "Shared user not found in the company.");
      }
    }

    const existingShare = await documentsRepository.findShareByTarget(
      companyId,
      documentId,
      sharedWithUserId,
      sharedWithRole,
    );

    if (existingShare) {
      const updated = await documentsRepository.updateDocumentShare({
        companyId,
        shareId: existingShare.id,
        sharedByUserId: user.id,
        permission: input.permission,
      });

      if (!updated) {
        return fail(409, "Unable to update the existing share.");
      }
    } else {
      const created = await documentsRepository.createDocumentShare({
        id: randomUUID(),
        companyId,
        documentId,
        sharedWithUserId,
        sharedWithRole,
        sharedByUserId: user.id,
        permission: input.permission,
      });

      if (!created) {
        return fail(409, "Unable to create the document share.");
      }
    }

    const share = await documentsRepository.findShareByTarget(
      companyId,
      documentId,
      sharedWithUserId,
      sharedWithRole,
    );

    if (!share) {
      return fail(404, "Share not found.");
    }

    void auditService.recordAction(user, {
      action: "document.shared",
      entityType: "document-share",
      entityId: share.id,
      metadata: {
        document: {
          id: documentId,
          name: document.name,
        },
        share: {
          id: share.id,
          sharedWithUserId,
          sharedWithRole,
          permission: input.permission,
        },
      },
    });

    return ok({
      message: "Document shared successfully.",
      share,
    });
  },

  async revokeDocumentShare(
    user: AuthenticatedUser,
    documentId: string,
    shareId: string,
  ): Promise<DocumentsServiceResult<{ message: string }>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!isDocumentsManager(user)) {
      return fail(403, "This account cannot revoke document shares.");
    }

    const revoked = await documentsRepository.revokeDocumentShare(
      companyId,
      documentId,
      shareId,
    );

    if (!revoked) {
      return fail(404, "Share not found.");
    }

    void auditService.recordAction(user, {
      action: "document-share.revoked",
      entityType: "document-share",
      entityId: shareId,
      metadata: {
        document: {
          id: documentId,
        },
      },
    });

    return ok({
      message: "Document share revoked successfully.",
    });
  },
};
