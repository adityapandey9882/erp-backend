import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole, type AppRole } from "../roles/roles.types.js";
import type {
  DocumentFolderRecord,
  DocumentRecord,
  DocumentsWorkspaceSummary,
  DocumentSharePermission,
  DocumentShareRecord,
  DocumentsWorkspaceTab,
  DocumentSortBy,
  DocumentSortOrder,
} from "./documents.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type DocumentRow = {
  id: string;
  companyId: string;
  userId: string | null;
  linkedUserId: string | null;
  linkedUserFullName: string | null;
  linkedUserEmail: string | null;
  linkedUserRole: string | null;
  folderId: string | null;
  folderName: string | null;
  isCompanyWide: boolean | null;
  name: string;
  type: string;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | string | null;
  downloadCount: number | string | null;
  uploadedById: string | null;
  uploadedByFullName: string | null;
  uploadedByEmail: string | null;
  uploadedByRole: string | null;
  sharePermission: string | null;
  deletedAt: Date | string | null;
  createdAt: Date | string;
};

type DocumentFolderRow = {
  id: string;
  companyId: string;
  userId: string | null;
  parentFolderId: string | null;
  folderScope: string;
  name: string;
  isSystem: boolean;
  documentCount: number | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

type DocumentShareRow = {
  id: string;
  documentId: string;
  sharedWithUserId: string | null;
  sharedWithUserFullName: string | null;
  sharedWithUserEmail: string | null;
  sharedWithUserRole: string | null;
  sharedWithRole: string | null;
  sharedById: string | null;
  sharedByFullName: string | null;
  sharedByEmail: string | null;
  sharedByRole: string | null;
  permission: string;
  createdAt: Date | string;
  revokedAt: Date | string | null;
};

type DocumentSummaryRow = {
  totalDocuments: number;
  linkedDocuments: number;
  companyWideDocuments: number;
};

type DocumentAggregateRow = {
  totalItems: number | string | null;
  totalDownloads: number | string | null;
  totalSizeBytes: number | string | null;
};

type StorageQuotaRow = {
  userQuotaBytes: number | string | null;
  companyQuotaBytes: number | string | null;
};

type DocumentsListQueryArgs = {
  companyId: string;
  role: AppRole;
  requestUserId: string | null;
  requestUserRole: AppRole | null;
  filterUserId?: string | null;
  tab: DocumentsWorkspaceTab;
  search?: string | null;
  documentType?: string | null;
  uploadedBy?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  folderId?: string | null;
  sortBy?: DocumentSortBy;
  sortOrder?: DocumentSortOrder;
  page?: number;
  limit?: number | null;
  documentId?: string | null;
};

type QueryAliases = {
  document: string;
  uploader: string;
  share: string;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeNullableText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function parseDataUrlMetadata(fileUrl: string) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(fileUrl);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    sizeBytes: Buffer.from(match[2], "base64").length,
  };
}

function extensionFromPath(pathValue: string | null) {
  if (!pathValue) {
    return null;
  }

  const segment = pathValue.split("/").filter(Boolean).at(-1) ?? pathValue;
  const extension = segment.split(".").at(-1)?.trim().toLowerCase() ?? "";

  return extension || null;
}

function mimeTypeFromExtension(extension: string | null) {
  if (!extension) {
    return null;
  }

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  return mimeTypes[extension] ?? null;
}

function extensionFromMimeType(mimeType: string | null) {
  if (!mimeType) {
    return null;
  }

  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "image/jpeg": "jpg",
    "image/png": "png",
  };

  return extensions[mimeType.toLowerCase()] ?? null;
}

function deriveFileName(row: Pick<DocumentRow, "fileName" | "fileUrl" | "mimeType" | "name">) {
  const explicitFileName = normalizeNullableText(row.fileName);

  if (explicitFileName) {
    return explicitFileName;
  }

  if (!row.fileUrl.startsWith("data:")) {
    try {
      const parsedUrl = new URL(row.fileUrl);
      const lastSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";

      if (lastSegment) {
        return decodeURIComponent(lastSegment);
      }
    } catch {
      // Ignore parse failures and fall back to the document name.
    }
  }

  const resolvedMimeType =
    normalizeNullableText(row.mimeType) ??
    parseDataUrlMetadata(row.fileUrl)?.mimeType ??
    mimeTypeFromExtension(extensionFromPath(row.fileUrl));
  const extension = extensionFromMimeType(resolvedMimeType);

  return extension ? `${row.name}.${extension}` : row.name;
}

function mapUserSummary(row: {
  id: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
}) {
  if (
    !row.id ||
    !row.fullName ||
    !row.email ||
    !row.role ||
    !isAppRole(row.role)
  ) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role,
  };
}

function mapSharePermission(value: string | null): DocumentSharePermission | null {
  return value === "view" || value === "download" || value === "manage"
    ? value
    : null;
}

function mapDocumentRow(row: DocumentRow | undefined): DocumentRecord | null {
  if (!row) {
    return null;
  }

  const uploadedBy = mapUserSummary({
    id: row.uploadedById,
    fullName: row.uploadedByFullName,
    email: row.uploadedByEmail,
    role: row.uploadedByRole,
  });
  const inferredDataUrlMetadata = parseDataUrlMetadata(row.fileUrl);
  const fileName = deriveFileName(row);
  const mimeType =
    normalizeNullableText(row.mimeType) ??
    inferredDataUrlMetadata?.mimeType ??
    mimeTypeFromExtension(extensionFromPath(fileName));
  const normalizedSizeBytes =
    row.sizeBytes === null || row.sizeBytes === undefined
      ? inferredDataUrlMetadata?.sizeBytes ?? null
      : Number(row.sizeBytes);
  const normalizedDownloadCount =
    row.downloadCount === null || row.downloadCount === undefined
      ? 0
      : Number(row.downloadCount);

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    linkedUser: mapUserSummary({
      id: row.linkedUserId,
      fullName: row.linkedUserFullName,
      email: row.linkedUserEmail,
      role: row.linkedUserRole,
    }),
    folderId: row.folderId,
    folderName: normalizeNullableText(row.folderName),
    isCompanyWide: Boolean(row.isCompanyWide),
    name: row.name,
    type: row.type,
    description: normalizeNullableText(row.description),
    fileUrl: row.fileUrl,
    fileName,
    mimeType,
    sizeBytes:
      normalizedSizeBytes !== null && Number.isFinite(normalizedSizeBytes)
        ? normalizedSizeBytes
        : null,
    downloadCount:
      Number.isFinite(normalizedDownloadCount) && normalizedDownloadCount >= 0
        ? normalizedDownloadCount
        : 0,
    uploadedBy,
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    sharedWithMe: false,
    sharePermission: mapSharePermission(row.sharePermission),
    deletedAt: toIsoString(row.deletedAt),
    canDownload: false,
    canEdit: false,
    canDelete: false,
    canRestore: false,
  };
}

function mapFolderRow(row: DocumentFolderRow | undefined): DocumentFolderRecord | null {
  if (!row) {
    return null;
  }

  const folderScope =
    row.folderScope === "personal" || row.folderScope === "company"
      ? row.folderScope
      : null;

  if (!folderScope) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    parentFolderId: row.parentFolderId,
    folderScope,
    name: row.name,
    isSystem: Boolean(row.isSystem),
    documentCount:
      row.documentCount === null || row.documentCount === undefined
        ? 0
        : Number(row.documentCount),
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: toIsoString(row.deletedAt),
  };
}

function mapShareRow(row: DocumentShareRow | undefined): DocumentShareRecord | null {
  if (!row) {
    return null;
  }

  const permission = mapSharePermission(row.permission);
  const sharedWithRole =
    row.sharedWithRole && isAppRole(row.sharedWithRole) ? row.sharedWithRole : null;

  if (!permission) {
    return null;
  }

  return {
    id: row.id,
    documentId: row.documentId,
    sharedWithUser: mapUserSummary({
      id: row.sharedWithUserId,
      fullName: row.sharedWithUserFullName,
      email: row.sharedWithUserEmail,
      role: row.sharedWithUserRole,
    }),
    sharedWithRole,
    sharedBy: mapUserSummary({
      id: row.sharedById,
      fullName: row.sharedByFullName,
      email: row.sharedByEmail,
      role: row.sharedByRole,
    }),
    permission,
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    revokedAt: toIsoString(row.revokedAt),
  };
}

const documentFromSql = `
  FROM documents
  LEFT JOIN users AS linked_user
    ON linked_user.id = documents.user_id
  LEFT JOIN users AS uploader
    ON uploader.id = documents.uploaded_by
  LEFT JOIN document_folders AS folders
    ON folders.id = documents.folder_id
   AND folders.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT document_shares.permission
    FROM document_shares
    WHERE document_shares.document_id = documents.id
      AND document_shares.revoked_at IS NULL
      AND (
        ($2::text IS NOT NULL AND document_shares.shared_with_user_id = $2)
        OR ($3::text IS NOT NULL AND document_shares.shared_with_role = $3)
      )
    ORDER BY
      CASE document_shares.permission
        WHEN 'manage' THEN 3
        WHEN 'download' THEN 2
        WHEN 'view' THEN 1
        ELSE 0
      END DESC,
      document_shares.created_at DESC
    LIMIT 1
  ) AS visible_share
    ON TRUE
`;

const documentSelectSql = `
  SELECT
    documents.id,
    documents.company_id AS "companyId",
    documents.user_id AS "userId",
    linked_user.id AS "linkedUserId",
    linked_user.full_name AS "linkedUserFullName",
    linked_user.email AS "linkedUserEmail",
    linked_user.role AS "linkedUserRole",
    documents.folder_id AS "folderId",
    folders.name AS "folderName",
    documents.is_company_wide AS "isCompanyWide",
    documents.name,
    documents.type,
    documents.description,
    documents.file_url AS "fileUrl",
    documents.file_name AS "fileName",
    documents.mime_type AS "mimeType",
    documents.size_bytes AS "sizeBytes",
    documents.download_count AS "downloadCount",
    uploader.id AS "uploadedById",
    uploader.full_name AS "uploadedByFullName",
    uploader.email AS "uploadedByEmail",
    uploader.role AS "uploadedByRole",
    visible_share.permission AS "sharePermission",
    documents.deleted_at AS "deletedAt",
    documents.created_at AS "createdAt"
  ${documentFromSql}
`;

function buildDocumentVisibilityConditions(
  args: DocumentsListQueryArgs,
  params: unknown[],
  aliases: QueryAliases,
) {
  const includeDeleted = args.tab === "recycle";
  const conditions = [
    `${aliases.document}.company_id = $1`,
    includeDeleted
      ? `${aliases.document}.deleted_at IS NOT NULL`
      : `${aliases.document}.deleted_at IS NULL`,
  ];

  if (args.role === "employee") {
    if (args.tab === "shared") {
      conditions.push(`${aliases.document}.user_id IS DISTINCT FROM $2`);
      conditions.push(
        `(COALESCE(${aliases.document}.is_company_wide, FALSE) = TRUE OR ${aliases.share}.permission IS NOT NULL)`,
      );
    } else {
      conditions.push(`${aliases.document}.user_id = $2`);
    }
  } else if (args.filterUserId) {
    conditions.push(`${aliases.document}.user_id = $${params.push(args.filterUserId)}`);
  }

  return conditions;
}

function buildDocumentFilterConditions(
  args: DocumentsListQueryArgs,
  params: unknown[],
  aliases: QueryAliases,
  options: {
    includeFolderFilter?: boolean;
    includeDocumentId?: boolean;
  } = {},
) {
  const conditions: string[] = [];
  const includeFolderFilter = options.includeFolderFilter ?? true;
  const includeDocumentId = options.includeDocumentId ?? true;
  const normalizedSearch = normalizeNullableText(args.search);
  const normalizedType = normalizeNullableText(args.documentType);
  const normalizedUploader = normalizeNullableText(args.uploadedBy);
  const normalizedFromDate = normalizeNullableText(args.fromDate);
  const normalizedToDate = normalizeNullableText(args.toDate);
  const normalizedFolderId = normalizeNullableText(args.folderId);
  const normalizedDocumentId = normalizeNullableText(args.documentId);

  if (includeDocumentId && normalizedDocumentId) {
    conditions.push(`${aliases.document}.id = $${params.push(normalizedDocumentId)}`);
  }

  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;

    conditions.push(
      `(${aliases.document}.name ILIKE $${params.push(pattern)} OR COALESCE(${aliases.document}.description, '') ILIKE $${params.push(pattern)} OR COALESCE(${aliases.document}.file_name, '') ILIKE $${params.push(pattern)})`,
    );
  }

  if (normalizedType) {
    conditions.push(`${aliases.document}.type = $${params.push(normalizedType)}`);
  }

  if (normalizedUploader) {
    conditions.push(`${aliases.uploader}.full_name = $${params.push(normalizedUploader)}`);
  }

  if (normalizedFromDate) {
    conditions.push(
      `${aliases.document}.created_at >= $${params.push(`${normalizedFromDate}T00:00:00.000Z`)}`,
    );
  }

  if (normalizedToDate) {
    conditions.push(
      `${aliases.document}.created_at <= $${params.push(`${normalizedToDate}T23:59:59.999Z`)}`,
    );
  }

  if (includeFolderFilter && normalizedFolderId) {
    conditions.push(`${aliases.document}.folder_id = $${params.push(normalizedFolderId)}`);
  }

  return conditions;
}

function resolveOrderBy(sortBy: DocumentSortBy | undefined, sortOrder: DocumentSortOrder | undefined) {
  const normalizedSortBy = sortBy ?? "createdAt";
  const normalizedSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

  if (normalizedSortBy === "name") {
    return `documents.name ${normalizedSortOrder}, documents.created_at DESC`;
  }

  if (normalizedSortBy === "downloadCount") {
    return `documents.download_count ${normalizedSortOrder}, documents.created_at DESC`;
  }

  return `documents.created_at ${normalizedSortOrder}, documents.name ASC`;
}

function mapAggregateRow(row: DocumentAggregateRow | undefined) {
  return {
    totalItems:
      row?.totalItems === null || row?.totalItems === undefined
        ? 0
        : Number(row.totalItems),
    totalDownloads:
      row?.totalDownloads === null || row?.totalDownloads === undefined
        ? 0
        : Number(row.totalDownloads),
    totalSizeBytes:
      row?.totalSizeBytes === null || row?.totalSizeBytes === undefined
        ? 0
        : Number(row.totalSizeBytes),
  };
}

export const documentsRepository = {
  async getCompanySummary(
    companyId: string,
    executor?: DatabaseExecutor,
  ): Promise<DocumentsWorkspaceSummary> {
    const result = await resolveExecutor(executor).query<DocumentSummaryRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS "totalDocuments",
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND user_id IS NOT NULL)::int AS "linkedDocuments",
          COUNT(*) FILTER (
            WHERE deleted_at IS NULL
              AND (COALESCE(is_company_wide, FALSE) = TRUE OR user_id IS NULL)
          )::int AS "companyWideDocuments"
        FROM documents
        WHERE company_id = $1
      `,
      [companyId],
    );

    const row = result.rows[0];

    return {
      totalDocuments: row?.totalDocuments ?? 0,
      linkedDocuments: row?.linkedDocuments ?? 0,
      companyWideDocuments: row?.companyWideDocuments ?? 0,
      visibleDocuments: row?.totalDocuments ?? 0,
      myDocuments: 0,
      sharedDocuments: 0,
      recycleBinDocuments: 0,
      visibleDownloadCount: 0,
    };
  },

  async listDocumentsForWorkspace(
    args: DocumentsListQueryArgs,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [
      args.companyId,
      args.requestUserId,
      args.requestUserRole,
    ];
    const aliases: QueryAliases = {
      document: "documents",
      uploader: "uploader",
      share: "visible_share",
    };
    const whereConditions = [
      ...buildDocumentVisibilityConditions(args, params, aliases),
      ...buildDocumentFilterConditions(args, params, aliases),
    ];
    const whereSql = whereConditions.join("\n        AND ");
    const countResult = await resolveExecutor(executor).query<{ totalItems: number }>(
      `
        SELECT COUNT(*)::int AS "totalItems"
        ${documentFromSql}
        WHERE ${whereSql}
      `,
      params,
    );
    const totalItems = Number(countResult.rows[0]?.totalItems ?? 0);
    const limit =
      typeof args.limit === "number" && args.limit > 0
        ? Math.min(Math.max(Math.round(args.limit), 1), 100)
        : null;
    const requestedPage =
      typeof args.page === "number" && args.page > 0
        ? Math.max(Math.round(args.page), 1)
        : 1;
    const totalPages = limit ? Math.max(1, Math.ceil(totalItems / limit)) : 1;
    const page = limit ? Math.min(requestedPage, totalPages) : requestedPage;
    const listParams = [...params];
    let paginationSql = "";

    if (limit) {
      paginationSql = `
        LIMIT $${listParams.push(limit)}
        OFFSET $${listParams.push((page - 1) * limit)}
      `;
    }

    const listResult = await resolveExecutor(executor).query<DocumentRow>(
      `
        ${documentSelectSql}
        WHERE ${whereSql}
        ORDER BY ${resolveOrderBy(args.sortBy, args.sortOrder)}
        ${paginationSql}
      `,
      listParams,
    );

    return {
      documents: listResult.rows
        .map((row) => mapDocumentRow(row))
        .filter((row): row is DocumentRecord => row !== null),
      totalItems,
      page,
      limit: limit ?? Math.max(totalItems, 1),
      totalPages,
    };
  },

  async aggregateDocuments(
    args: DocumentsListQueryArgs,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [
      args.companyId,
      args.requestUserId,
      args.requestUserRole,
    ];
    const aliases: QueryAliases = {
      document: "documents",
      uploader: "uploader",
      share: "visible_share",
    };
    const whereConditions = [
      ...buildDocumentVisibilityConditions(args, params, aliases),
      ...buildDocumentFilterConditions(args, params, aliases),
    ];
    const result = await resolveExecutor(executor).query<DocumentAggregateRow>(
      `
        SELECT
          COUNT(*)::int AS "totalItems",
          COALESCE(SUM(documents.download_count), 0)::bigint AS "totalDownloads",
          COALESCE(SUM(COALESCE(documents.size_bytes, 0)), 0)::bigint AS "totalSizeBytes"
        ${documentFromSql}
        WHERE ${whereConditions.join("\n          AND ")}
      `,
      params,
    );

    return mapAggregateRow(result.rows[0]);
  },

  async listFolderRecords(
    args: DocumentsListQueryArgs,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [
      args.companyId,
      args.requestUserId,
      args.requestUserRole,
    ];
    const countAliases: QueryAliases = {
      document: "d",
      uploader: "folder_uploader",
      share: "folder_share",
    };
    const folderDocumentConditions = [
      ...buildDocumentVisibilityConditions(args, params, countAliases),
      ...buildDocumentFilterConditions(args, params, countAliases, {
        includeFolderFilter: false,
        includeDocumentId: false,
      }),
      "d.folder_id = folders.id",
    ];
    const folderConditions = ["folders.company_id = $1", "folders.deleted_at IS NULL"];

    if (args.role === "employee") {
      if (args.tab === "shared") {
        folderConditions.push("folders.folder_scope = 'company'");
        folderConditions.push("folders.user_id IS NULL");
      } else {
        folderConditions.push("folders.folder_scope = 'personal'");
        folderConditions.push("folders.user_id = $2");
      }
    } else if (args.filterUserId) {
      const filterUserIndex = params.push(args.filterUserId);
      folderConditions.push(
        `(folders.folder_scope = 'company' OR (folders.folder_scope = 'personal' AND folders.user_id = $${filterUserIndex}))`,
      );
    } else {
      folderConditions.push("folders.folder_scope = 'company'");
    }

    const result = await resolveExecutor(executor).query<DocumentFolderRow>(
      `
        SELECT
          folders.id,
          folders.company_id AS "companyId",
          folders.user_id AS "userId",
          folders.parent_folder_id AS "parentFolderId",
          folders.folder_scope AS "folderScope",
          folders.name,
          folders.is_system AS "isSystem",
          COALESCE((
            SELECT COUNT(*)::int
            FROM documents AS d
            LEFT JOIN users AS folder_uploader
              ON folder_uploader.id = d.uploaded_by
            LEFT JOIN LATERAL (
              SELECT document_shares.permission
              FROM document_shares
              WHERE document_shares.document_id = d.id
                AND document_shares.revoked_at IS NULL
                AND (
                  ($2::text IS NOT NULL AND document_shares.shared_with_user_id = $2)
                  OR ($3::text IS NOT NULL AND document_shares.shared_with_role = $3)
                )
              ORDER BY
                CASE document_shares.permission
                  WHEN 'manage' THEN 3
                  WHEN 'download' THEN 2
                  WHEN 'view' THEN 1
                  ELSE 0
                END DESC,
                document_shares.created_at DESC
              LIMIT 1
            ) AS folder_share
              ON TRUE
            WHERE ${folderDocumentConditions.join("\n              AND ")}
          ), 0)::int AS "documentCount",
          folders.created_at AS "createdAt",
          folders.updated_at AS "updatedAt",
          folders.deleted_at AS "deletedAt"
        FROM document_folders AS folders
        WHERE ${folderConditions.join("\n          AND ")}
        ORDER BY LOWER(folders.name) ASC, folders.created_at ASC
      `,
      params,
    );

    return result.rows
      .map((row) => mapFolderRow(row))
      .filter((row): row is DocumentFolderRecord => row !== null);
  },

  async listFilterOptions(
    args: DocumentsListQueryArgs,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [
      args.companyId,
      args.requestUserId,
      args.requestUserRole,
    ];
    const aliases: QueryAliases = {
      document: "documents",
      uploader: "uploader",
      share: "visible_share",
    };
    const whereConditions = buildDocumentVisibilityConditions(args, params, aliases);

    const [uploaderResult, typeResult] = await Promise.all([
      resolveExecutor(executor).query<{ value: string }>(
        `
          SELECT DISTINCT uploader.full_name AS value
          ${documentFromSql}
          WHERE ${whereConditions.join("\n            AND ")}
            AND uploader.full_name IS NOT NULL
          ORDER BY uploader.full_name ASC
        `,
        params,
      ),
      resolveExecutor(executor).query<{ value: string }>(
        `
          SELECT DISTINCT documents.type AS value
          ${documentFromSql}
          WHERE ${whereConditions.join("\n            AND ")}
            AND documents.type IS NOT NULL
          ORDER BY documents.type ASC
        `,
        params,
      ),
    ]);

    return {
      uploadedBy: uploaderResult.rows
        .map((row) => normalizeNullableText(row.value))
        .filter((row): row is string => Boolean(row)),
      documentTypes: typeResult.rows
        .map((row) => normalizeNullableText(row.value))
        .filter((row): row is string => Boolean(row)),
    };
  },

  async resolveQuota(
    companyId: string,
    userId?: string | null,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<StorageQuotaRow>(
      `
        SELECT
          users.document_storage_quota_bytes AS "userQuotaBytes",
          companies.document_storage_quota_bytes AS "companyQuotaBytes"
        FROM companies
        LEFT JOIN users
          ON users.id = $2
         AND users.company_id = companies.id
        WHERE companies.id = $1
        LIMIT 1
      `,
      [companyId, userId ?? null],
    );

    const row = result.rows[0];

    return {
      userQuotaBytes:
        row?.userQuotaBytes === null || row?.userQuotaBytes === undefined
          ? null
          : Number(row.userQuotaBytes),
      companyQuotaBytes:
        row?.companyQuotaBytes === null || row?.companyQuotaBytes === undefined
          ? null
          : Number(row.companyQuotaBytes),
    };
  },

  async findFolderById(
    companyId: string,
    folderId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<DocumentFolderRow>(
      `
        SELECT
          folders.id,
          folders.company_id AS "companyId",
          folders.user_id AS "userId",
          folders.parent_folder_id AS "parentFolderId",
          folders.folder_scope AS "folderScope",
          folders.name,
          folders.is_system AS "isSystem",
          0::int AS "documentCount",
          folders.created_at AS "createdAt",
          folders.updated_at AS "updatedAt",
          folders.deleted_at AS "deletedAt"
        FROM document_folders AS folders
        WHERE folders.company_id = $1
          AND folders.id = $2
        LIMIT 1
      `,
      [companyId, folderId],
    );

    return mapFolderRow(result.rows[0]);
  },

  async createFolder(
    input: {
      id: string;
      companyId: string;
      userId: string | null;
      parentFolderId: string | null;
      folderScope: "personal" | "company";
      name: string;
      isSystem: boolean;
      createdBy: string | null;
      updatedBy: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO document_folders (
          id,
          company_id,
          user_id,
          parent_folder_id,
          folder_scope,
          name,
          is_system,
          created_by,
          updated_by,
          created_at,
          updated_at,
          deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NULL)
        RETURNING id
      `,
      [
        input.id ?? randomUUID(),
        input.companyId,
        input.userId,
        input.parentFolderId,
        input.folderScope,
        input.name,
        input.isSystem,
        input.createdBy,
        input.updatedBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateFolder(
    input: {
      companyId: string;
      folderId: string;
      name?: string;
      parentFolderId?: string | null;
      updatedBy: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const assignments = [`updated_at = NOW()`, `updated_by = $${3}`];
    const params: unknown[] = [input.companyId, input.folderId, input.updatedBy];

    if (input.name !== undefined) {
      assignments.push(`name = $${params.push(input.name)}`);
    }

    if (input.parentFolderId !== undefined) {
      assignments.push(`parent_folder_id = $${params.push(input.parentFolderId)}`);
    }

    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE document_folders
        SET ${assignments.join(", ")}
        WHERE company_id = $1
          AND id = $2
          AND deleted_at IS NULL
        RETURNING id
      `,
      params,
    );

    return Boolean(result.rows[0]?.id);
  },

  async detachChildFolders(
    companyId: string,
    folderId: string,
    updatedBy: string | null,
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        UPDATE document_folders
        SET parent_folder_id = NULL,
            updated_by = $3,
            updated_at = NOW()
        WHERE company_id = $1
          AND parent_folder_id = $2
          AND deleted_at IS NULL
      `,
      [companyId, folderId, updatedBy],
    );
  },

  async softDeleteFolder(
    companyId: string,
    folderId: string,
    updatedBy: string | null,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE document_folders
        SET deleted_at = NOW(),
            updated_by = $3,
            updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
          AND deleted_at IS NULL
        RETURNING id
      `,
      [companyId, folderId, updatedBy],
    );

    return Boolean(result.rows[0]?.id);
  },

  async countActiveDocumentsInFolder(
    companyId: string,
    folderId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ totalItems: number }>(
      `
        SELECT COUNT(*)::int AS "totalItems"
        FROM documents
        WHERE company_id = $1
          AND folder_id = $2
          AND deleted_at IS NULL
      `,
      [companyId, folderId],
    );

    return Number(result.rows[0]?.totalItems ?? 0);
  },

  async countActiveChildFolders(
    companyId: string,
    folderId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ totalItems: number }>(
      `
        SELECT COUNT(*)::int AS "totalItems"
        FROM document_folders
        WHERE company_id = $1
          AND parent_folder_id = $2
          AND deleted_at IS NULL
      `,
      [companyId, folderId],
    );

    return Number(result.rows[0]?.totalItems ?? 0);
  },

  async findDocumentById(
    companyId: string,
    documentId: string,
    requestUserId?: string | null,
    requestUserRole?: AppRole | null,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<DocumentRow>(
      `
        ${documentSelectSql}
        WHERE documents.company_id = $1
          AND documents.id = $4
        LIMIT 1
      `,
      [companyId, requestUserId ?? null, requestUserRole ?? null, documentId],
    );

    return mapDocumentRow(result.rows[0]);
  },

  async createDocument(
    input: {
      id: string;
      companyId: string;
      userId: string | null;
      folderId: string | null;
      isCompanyWide: boolean;
      name: string;
      type: string;
      description: string | null;
      fileUrl: string;
      fileName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      uploadedBy: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO documents (
          id,
          company_id,
          user_id,
          folder_id,
          is_company_wide,
          name,
          type,
          description,
          file_url,
          file_name,
          mime_type,
          size_bytes,
          download_count,
          deleted_at,
          deleted_by,
          uploaded_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NULL, NULL, $13, NOW())
        RETURNING id
      `,
      [
        input.id ?? randomUUID(),
        input.companyId,
        input.userId,
        input.folderId,
        input.isCompanyWide,
        input.name,
        input.type,
        input.description,
        input.fileUrl,
        input.fileName,
        input.mimeType,
        input.sizeBytes,
        input.uploadedBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateDocument(
    input: {
      companyId: string;
      documentId: string;
      name?: string;
      type?: string;
      folderId?: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const assignments: string[] = [];
    const params: unknown[] = [input.companyId, input.documentId];

    if (input.name !== undefined) {
      assignments.push(`name = $${params.push(input.name)}`);
    }

    if (input.type !== undefined) {
      assignments.push(`type = $${params.push(input.type)}`);
    }

    if (input.folderId !== undefined) {
      assignments.push(`folder_id = $${params.push(input.folderId)}`);
    }

    if (!assignments.length) {
      return false;
    }

    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE documents
        SET ${assignments.join(", ")}
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      params,
    );

    return Boolean(result.rows[0]?.id);
  },

  async softDeleteDocument(
    companyId: string,
    documentId: string,
    deletedBy: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE documents
        SET deleted_at = NOW(),
            deleted_by = $3
        WHERE company_id = $1
          AND id = $2
          AND deleted_at IS NULL
        RETURNING id
      `,
      [companyId, documentId, deletedBy],
    );

    return Boolean(result.rows[0]?.id);
  },

  async restoreDocument(
    companyId: string,
    documentId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE documents
        SET deleted_at = NULL,
            deleted_by = NULL
        WHERE company_id = $1
          AND id = $2
          AND deleted_at IS NOT NULL
        RETURNING id
      `,
      [companyId, documentId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async permanentlyDeleteDocument(
    companyId: string,
    documentId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        DELETE FROM documents
        WHERE company_id = $1
          AND id = $2
          AND deleted_at IS NOT NULL
        RETURNING id
      `,
      [companyId, documentId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async incrementDownloadCount(
    companyId: string,
    documentId: string,
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        UPDATE documents
        SET download_count = download_count + 1
        WHERE company_id = $1
          AND id = $2
      `,
      [companyId, documentId],
    );
  },

  async listDocumentShares(
    companyId: string,
    documentId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<DocumentShareRow>(
      `
        SELECT
          document_shares.id,
          document_shares.document_id AS "documentId",
          shared_with_user.id AS "sharedWithUserId",
          shared_with_user.full_name AS "sharedWithUserFullName",
          shared_with_user.email AS "sharedWithUserEmail",
          shared_with_user.role AS "sharedWithUserRole",
          document_shares.shared_with_role AS "sharedWithRole",
          shared_by_user.id AS "sharedById",
          shared_by_user.full_name AS "sharedByFullName",
          shared_by_user.email AS "sharedByEmail",
          shared_by_user.role AS "sharedByRole",
          document_shares.permission,
          document_shares.created_at AS "createdAt",
          document_shares.revoked_at AS "revokedAt"
        FROM document_shares
        INNER JOIN documents
          ON documents.id = document_shares.document_id
         AND documents.company_id = $1
        LEFT JOIN users AS shared_with_user
          ON shared_with_user.id = document_shares.shared_with_user_id
        LEFT JOIN users AS shared_by_user
          ON shared_by_user.id = document_shares.shared_by_user_id
        WHERE document_shares.document_id = $2
          AND document_shares.revoked_at IS NULL
        ORDER BY document_shares.created_at DESC
      `,
      [companyId, documentId],
    );

    return result.rows
      .map((row) => mapShareRow(row))
      .filter((row): row is DocumentShareRecord => row !== null);
  },

  async findShareByTarget(
    companyId: string,
    documentId: string,
    sharedWithUserId: string | null,
    sharedWithRole: AppRole | null,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<DocumentShareRow>(
      `
        SELECT
          document_shares.id,
          document_shares.document_id AS "documentId",
          shared_with_user.id AS "sharedWithUserId",
          shared_with_user.full_name AS "sharedWithUserFullName",
          shared_with_user.email AS "sharedWithUserEmail",
          shared_with_user.role AS "sharedWithUserRole",
          document_shares.shared_with_role AS "sharedWithRole",
          shared_by_user.id AS "sharedById",
          shared_by_user.full_name AS "sharedByFullName",
          shared_by_user.email AS "sharedByEmail",
          shared_by_user.role AS "sharedByRole",
          document_shares.permission,
          document_shares.created_at AS "createdAt",
          document_shares.revoked_at AS "revokedAt"
        FROM document_shares
        INNER JOIN documents
          ON documents.id = document_shares.document_id
         AND documents.company_id = $1
        LEFT JOIN users AS shared_with_user
          ON shared_with_user.id = document_shares.shared_with_user_id
        LEFT JOIN users AS shared_by_user
          ON shared_by_user.id = document_shares.shared_by_user_id
        WHERE document_shares.document_id = $2
          AND (
            ($3::text IS NOT NULL AND document_shares.shared_with_user_id = $3)
            OR ($4::text IS NOT NULL AND document_shares.shared_with_role = $4)
          )
        ORDER BY document_shares.created_at DESC
        LIMIT 1
      `,
      [companyId, documentId, sharedWithUserId, sharedWithRole],
    );

    return mapShareRow(result.rows[0]);
  },

  async createDocumentShare(
    input: {
      id: string;
      companyId: string;
      documentId: string;
      sharedWithUserId: string | null;
      sharedWithRole: AppRole | null;
      sharedByUserId: string | null;
      permission: DocumentSharePermission;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO document_shares (
          id,
          company_id,
          document_id,
          shared_with_user_id,
          shared_with_role,
          shared_by_user_id,
          permission,
          created_at,
          revoked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
        RETURNING id
      `,
      [
        input.id ?? randomUUID(),
        input.companyId,
        input.documentId,
        input.sharedWithUserId,
        input.sharedWithRole,
        input.sharedByUserId,
        input.permission,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateDocumentShare(
    input: {
      companyId: string;
      shareId: string;
      sharedByUserId: string | null;
      permission: DocumentSharePermission;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE document_shares
        SET permission = $3,
            shared_by_user_id = $4,
            created_at = NOW(),
            revoked_at = NULL
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [input.companyId, input.shareId, input.permission, input.sharedByUserId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async revokeDocumentShare(
    companyId: string,
    documentId: string,
    shareId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE document_shares
        SET revoked_at = NOW()
        WHERE company_id = $1
          AND document_id = $2
          AND id = $3
          AND revoked_at IS NULL
        RETURNING id
      `,
      [companyId, documentId, shareId],
    );

    return Boolean(result.rows[0]?.id);
  },
};
