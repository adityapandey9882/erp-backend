import type { ValidationResult } from "../auth/auth.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  CreateDocumentFolderRequest,
  CreateDocumentRequest,
  CreateDocumentShareRequest,
  UpdateDocumentFolderRequest,
  UpdateDocumentRequest,
} from "./documents.types.js";

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

type SupportedFileDescriptor = {
  canonicalExtension: string;
  mimeType: string;
  acceptedMimeTypes: string[];
  signatureKind: "pdf" | "ole" | "zip" | "jpeg" | "png";
};

type UploadedDocumentCandidate = {
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  buffer: Buffer;
};

const supportedFileDescriptors: Record<string, SupportedFileDescriptor> = {
  pdf: {
    canonicalExtension: "pdf",
    mimeType: "application/pdf",
    acceptedMimeTypes: ["application/pdf"],
    signatureKind: "pdf",
  },
  doc: {
    canonicalExtension: "doc",
    mimeType: "application/msword",
    acceptedMimeTypes: [
      "application/msword",
      "application/doc",
      "application/vnd.ms-word",
      "application/octet-stream",
    ],
    signatureKind: "ole",
  },
  docx: {
    canonicalExtension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    acceptedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    signatureKind: "zip",
  },
  xls: {
    canonicalExtension: "xls",
    mimeType: "application/vnd.ms-excel",
    acceptedMimeTypes: [
      "application/vnd.ms-excel",
      "application/excel",
      "application/xls",
      "application/octet-stream",
    ],
    signatureKind: "ole",
  },
  xlsx: {
    canonicalExtension: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    acceptedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    signatureKind: "zip",
  },
  jpg: {
    canonicalExtension: "jpg",
    mimeType: "image/jpeg",
    acceptedMimeTypes: ["image/jpeg", "image/pjpeg"],
    signatureKind: "jpeg",
  },
  jpeg: {
    canonicalExtension: "jpg",
    mimeType: "image/jpeg",
    acceptedMimeTypes: ["image/jpeg", "image/pjpeg"],
    signatureKind: "jpeg",
  },
  png: {
    canonicalExtension: "png",
    mimeType: "image/png",
    acceptedMimeTypes: ["image/png"],
    signatureKind: "png",
  },
};

function fail<T>(...errors: string[]): ValidationResult<T> {
  return {
    success: false,
    errors,
  };
}

function success<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function normalizeNullableBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return null;
}

function normalizeNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readFileExtension(fileName: string | null) {
  if (!fileName) {
    return null;
  }

  const segment = fileName.split(".").at(-1)?.trim().toLowerCase() ?? "";

  return segment || null;
}

function parseDataUrl(fileUrl: string) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(fileUrl);

  if (!match) {
    return null;
  }

  return {
    mimeType: (match[1] ?? "application/octet-stream").toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function readFileSignatureKind(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return "exe";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return "ole";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return "zip";
  }

  return null;
}

export function validateCreateDocumentPayload(
  input: unknown,
  uploadedFile?: UploadedDocumentCandidate | null,
): ValidationResult<CreateDocumentRequest> {
  if (!input || typeof input !== "object") {
    return fail("Document payload is required.");
  }

  const name = normalizeText((input as Record<string, unknown>).name);
  const type = normalizeText((input as Record<string, unknown>).type);
  const description = normalizeNullableText(
    (input as Record<string, unknown>).description,
  );
  const fileUrl = normalizeNullableText((input as Record<string, unknown>).fileUrl);
  const legacyFileName = normalizeNullableText(
    (input as Record<string, unknown>).fileName,
  );
  const legacyFileMimeType = normalizeNullableText(
    (input as Record<string, unknown>).fileMimeType,
  );
  const legacySizeBytes = normalizeNullableInteger(
    (input as Record<string, unknown>).sizeBytes,
  );
  const userId = normalizeNullableText((input as Record<string, unknown>).userId);
  const folderId = normalizeNullableText(
    (input as Record<string, unknown>).folderId,
  );
  const isCompanyWide = normalizeNullableBoolean(
    (input as Record<string, unknown>).isCompanyWide,
  );
  const errors: string[] = [];
  const legacyParsedFile = fileUrl ? parseDataUrl(fileUrl) : null;
  const resolvedUpload =
    uploadedFile?.buffer && uploadedFile.buffer.length > 0
      ? uploadedFile
      : legacyParsedFile
        ? {
            originalName: legacyFileName,
            mimeType: legacyFileMimeType ?? legacyParsedFile.mimeType,
            sizeBytes: legacySizeBytes ?? legacyParsedFile.buffer.length,
            buffer: legacyParsedFile.buffer,
          }
        : null;
  const resolvedFileName =
    normalizeNullableText(resolvedUpload?.originalName) ?? legacyFileName;
  const fileExtension = readFileExtension(resolvedFileName);
  const descriptor = fileExtension
    ? supportedFileDescriptors[fileExtension]
    : undefined;
  const normalizedMimeType =
    normalizeNullableText(resolvedUpload?.mimeType)?.toLowerCase() ?? null;
  const resolvedSizeBytes =
    typeof resolvedUpload?.sizeBytes === "number" && Number.isFinite(resolvedUpload.sizeBytes)
      ? Math.max(Math.round(resolvedUpload.sizeBytes), 0)
      : resolvedUpload?.buffer.length ?? 0;
  const signatureKind = resolvedUpload?.buffer
    ? readFileSignatureKind(resolvedUpload.buffer)
    : null;

  if (!name) {
    errors.push("Document name is required.");
  } else if (name.length > 160) {
    errors.push("Document name must be 160 characters or fewer.");
  }

  if (!type) {
    errors.push("Document type is required.");
  } else if (type.length > 120) {
    errors.push("Document type must be 120 characters or fewer.");
  }

  if (description && description.length > 2000) {
    errors.push("Document description must be 2000 characters or fewer.");
  }

  if (fileUrl && !legacyParsedFile && (!uploadedFile?.buffer || uploadedFile.buffer.length === 0)) {
    errors.push("Multipart document uploads must include a valid file attachment.");
  }

  if (!resolvedUpload?.buffer || resolvedUpload.buffer.length === 0) {
    errors.push("Attach a document file before uploading.");
  }

  if (userId && !isUuidLike(userId)) {
    errors.push("Document user identifier is invalid.");
  }

  if (folderId && !isUuidLike(folderId)) {
    errors.push("Document folder identifier is invalid.");
  }

  if (!resolvedFileName) {
    errors.push("The uploaded document file name is missing.");
  } else if (resolvedFileName.length > 255) {
    errors.push("Document file name must be 255 characters or fewer.");
  }

  if (normalizedMimeType && normalizedMimeType.length > 120) {
    errors.push("Document file MIME type must be 120 characters or fewer.");
  }

  if (!descriptor) {
    errors.push(
      "Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are supported.",
    );
  }

  if (
    descriptor &&
    normalizedMimeType &&
    !descriptor.acceptedMimeTypes.includes(normalizedMimeType)
  ) {
    errors.push(
      "Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are supported.",
    );
  }

  if (signatureKind === "exe") {
    errors.push("Executable files are not allowed.");
  }

  if (descriptor && signatureKind && signatureKind !== descriptor.signatureKind) {
    errors.push("The uploaded file content does not match the selected file type.");
  }

  if (descriptor && !signatureKind) {
    errors.push("The uploaded file could not be verified.");
  }

  if (resolvedSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    errors.push("Files larger than 25 MB are not supported.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name,
    type,
    description: description ?? undefined,
    fileName:
      resolvedFileName ??
      `document.${descriptor?.canonicalExtension ?? "bin"}`,
    fileMimeType: descriptor?.mimeType ?? "application/octet-stream",
    sizeBytes: resolvedSizeBytes,
    fileBuffer: resolvedUpload?.buffer ?? Buffer.alloc(0),
    userId: userId ?? undefined,
    folderId: folderId ?? undefined,
    isCompanyWide: isCompanyWide ?? undefined,
  });
}

export function validateUpdateDocumentPayload(
  input: unknown,
): ValidationResult<UpdateDocumentRequest> {
  if (!input || typeof input !== "object") {
    return fail("Document update payload is required.");
  }

  const name = normalizeNullableText((input as Record<string, unknown>).name);
  const type = normalizeNullableText((input as Record<string, unknown>).type);
  const rawFolderId = (input as Record<string, unknown>).folderId;
  const folderId =
    rawFolderId === null ? null : normalizeNullableText(rawFolderId);
  const errors: string[] = [];

  if (name !== null && name.length > 160) {
    errors.push("Document name must be 160 characters or fewer.");
  }

  if (type !== null && type.length > 120) {
    errors.push("Document type must be 120 characters or fewer.");
  }

  if (folderId && !isUuidLike(folderId)) {
    errors.push("Document folder identifier is invalid.");
  }

  if (name === null && type === null && rawFolderId === undefined) {
    errors.push("At least one document field must be updated.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name: name ?? undefined,
    type: type ?? undefined,
    folderId: rawFolderId === undefined ? undefined : folderId,
  });
}

export function validateCreateDocumentFolderPayload(
  input: unknown,
): ValidationResult<CreateDocumentFolderRequest> {
  if (!input || typeof input !== "object") {
    return fail("Folder payload is required.");
  }

  const name = normalizeText((input as Record<string, unknown>).name);
  const rawParentFolderId = (input as Record<string, unknown>).parentFolderId;
  const parentFolderId =
    rawParentFolderId === null ? null : normalizeNullableText(rawParentFolderId);
  const folderScope = normalizeNullableText(
    (input as Record<string, unknown>).folderScope,
  );
  const errors: string[] = [];

  if (!name) {
    errors.push("Folder name is required.");
  } else if (name.length > 120) {
    errors.push("Folder name must be 120 characters or fewer.");
  }

  if (parentFolderId && !isUuidLike(parentFolderId)) {
    errors.push("Parent folder identifier is invalid.");
  }

  if (
    folderScope !== null &&
    folderScope !== "personal" &&
    folderScope !== "company"
  ) {
    errors.push("Folder scope must be either personal or company.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name,
    parentFolderId: rawParentFolderId === undefined ? undefined : parentFolderId,
    folderScope:
      folderScope === "personal" || folderScope === "company"
        ? folderScope
        : undefined,
  });
}

export function validateUpdateDocumentFolderPayload(
  input: unknown,
): ValidationResult<UpdateDocumentFolderRequest> {
  if (!input || typeof input !== "object") {
    return fail("Folder update payload is required.");
  }

  const name = normalizeNullableText((input as Record<string, unknown>).name);
  const rawParentFolderId = (input as Record<string, unknown>).parentFolderId;
  const parentFolderId =
    rawParentFolderId === null ? null : normalizeNullableText(rawParentFolderId);
  const errors: string[] = [];

  if (name !== null && name.length > 120) {
    errors.push("Folder name must be 120 characters or fewer.");
  }

  if (parentFolderId && !isUuidLike(parentFolderId)) {
    errors.push("Parent folder identifier is invalid.");
  }

  if (name === null && rawParentFolderId === undefined) {
    errors.push("At least one folder field must be updated.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name: name ?? undefined,
    parentFolderId:
      rawParentFolderId === undefined ? undefined : parentFolderId,
  });
}

export function validateCreateDocumentSharePayload(
  input: unknown,
): ValidationResult<CreateDocumentShareRequest> {
  if (!input || typeof input !== "object") {
    return fail("Share payload is required.");
  }

  const sharedWithUserId = normalizeNullableText(
    (input as Record<string, unknown>).sharedWithUserId,
  );
  const sharedWithRole = normalizeNullableText(
    (input as Record<string, unknown>).sharedWithRole,
  );
  const permission = normalizeText((input as Record<string, unknown>).permission);
  const errors: string[] = [];

  if (!permission || !["view", "download", "manage"].includes(permission)) {
    errors.push("Share permission must be view, download, or manage.");
  }

  if (sharedWithUserId && !isUuidLike(sharedWithUserId)) {
    errors.push("Shared user identifier is invalid.");
  }

  if (sharedWithRole && !isAppRole(sharedWithRole)) {
    errors.push("Shared role is invalid.");
  }

  if (!sharedWithUserId && !sharedWithRole) {
    errors.push("Select a target user or role for sharing.");
  }

  if (sharedWithUserId && sharedWithRole) {
    errors.push("Choose either a target user or a target role, not both.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    sharedWithUserId: sharedWithUserId ?? undefined,
    sharedWithRole: sharedWithRole && isAppRole(sharedWithRole)
      ? sharedWithRole
      : undefined,
    permission: permission as CreateDocumentShareRequest["permission"],
  });
}
