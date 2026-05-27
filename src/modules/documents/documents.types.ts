import type { CompanyStatus } from "../companies/companies.types.js";
import type { AppRole } from "../roles/roles.types.js";

export type DocumentUserSummary = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
};

export type DocumentFolderScope = "personal" | "company";
export type DocumentSharePermission = "view" | "download" | "manage";
export type DocumentsWorkspaceTab = "my" | "shared" | "recycle";
export type DocumentSortBy = "createdAt" | "name" | "downloadCount";
export type DocumentSortOrder = "asc" | "desc";

export type DocumentFolderRecord = {
  id: string;
  companyId: string;
  userId: string | null;
  parentFolderId: string | null;
  folderScope: DocumentFolderScope;
  name: string;
  isSystem: boolean;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DocumentRecord = {
  id: string;
  companyId: string;
  userId: string | null;
  linkedUser: DocumentUserSummary | null;
  folderId: string | null;
  folderName: string | null;
  isCompanyWide: boolean;
  name: string;
  type: string;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  uploadedBy: DocumentUserSummary | null;
  createdAt: string;
  sharedWithMe: boolean;
  sharePermission: DocumentSharePermission | null;
  deletedAt: string | null;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
};

export type DocumentShareRecord = {
  id: string;
  documentId: string;
  sharedWithUser: DocumentUserSummary | null;
  sharedWithRole: AppRole | null;
  sharedBy: DocumentUserSummary | null;
  permission: DocumentSharePermission;
  createdAt: string;
  revokedAt: string | null;
};

export type DocumentsWorkspaceSummary = {
  totalDocuments: number;
  linkedDocuments: number;
  companyWideDocuments: number;
  visibleDocuments: number;
  myDocuments: number;
  sharedDocuments: number;
  recycleBinDocuments: number;
  visibleDownloadCount: number;
};

export type DocumentsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: DocumentsWorkspaceSummary;
  activeFilter: {
    userId: string | null;
    tab: DocumentsWorkspaceTab;
    search: string;
    documentType: string | null;
    uploadedBy: string | null;
    fromDate: string | null;
    toDate: string | null;
    folderId: string | null;
    sortBy: DocumentSortBy;
    sortOrder: DocumentSortOrder;
    page: number;
    limit: number | null;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  availableUsers: DocumentUserSummary[];
  folders: DocumentFolderRecord[];
  filterOptions: {
    uploadedBy: string[];
    documentTypes: string[];
  };
  documents: DocumentRecord[];
  myDocuments: DocumentRecord[];
  sharedDocuments: DocumentRecord[];
  storage: {
    usedBytes: number;
    quotaBytes: number | null;
    availableBytes: number | null;
    isQuotaConfigured: boolean;
  };
};

export type DocumentMutationResponse = {
  message: string;
  document: DocumentRecord;
};

export type DocumentLookupResponse = {
  document: DocumentRecord;
};

export type DocumentFolderMutationResponse = {
  message: string;
  folder: DocumentFolderRecord;
};

export type DocumentFoldersResponse = {
  folders: DocumentFolderRecord[];
};

export type DocumentShareMutationResponse = {
  message: string;
  share: DocumentShareRecord;
};

export type DocumentSharesResponse = {
  shares: DocumentShareRecord[];
};

export type CreateDocumentRequest = {
  name: string;
  type: string;
  description?: string | null;
  userId?: string | null;
  folderId?: string | null;
  isCompanyWide?: boolean;
  fileName: string;
  fileMimeType: string;
  sizeBytes: number;
  fileBuffer: Buffer;
};

export type UpdateDocumentRequest = {
  name?: string;
  type?: string;
  folderId?: string | null;
};

export type CreateDocumentFolderRequest = {
  name: string;
  parentFolderId?: string | null;
  folderScope?: DocumentFolderScope;
};

export type UpdateDocumentFolderRequest = {
  name?: string;
  parentFolderId?: string | null;
};

export type CreateDocumentShareRequest = {
  sharedWithUserId?: string | null;
  sharedWithRole?: AppRole | null;
  permission: DocumentSharePermission;
};

export type DocumentsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      message: string;
    };
