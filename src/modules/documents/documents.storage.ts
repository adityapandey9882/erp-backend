import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseConfig } from "../../config/supabase.config.js";

const LOCAL_STORAGE_PREFIX = "local://documents/";
const SUPABASE_STORAGE_PREFIX = "supabase://";
const LOCAL_DOCUMENT_STORAGE_ROOT = path.resolve(
  process.cwd(),
  "storage",
  "documents",
);

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseConfig.isConfigured) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseClient;
}

function sanitizeStorageFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "document";
}

function buildScopedRelativePath(input: {
  companyId: string;
  documentId: string;
  userId: string | null;
  isCompanyWide: boolean;
  fileName: string;
}) {
  const scopeDirectory = input.userId
    ? ["users", input.userId]
    : input.isCompanyWide
      ? ["company"]
      : ["shared"];

  return [
    input.companyId,
    ...scopeDirectory,
    input.documentId,
    sanitizeStorageFileName(input.fileName),
  ].join("/");
}

function resolveLocalAbsolutePath(relativePath: string) {
  const segments = relativePath.split("/").filter(Boolean);
  const absolutePath = path.resolve(LOCAL_DOCUMENT_STORAGE_ROOT, ...segments);
  const normalizedRoot = path.resolve(LOCAL_DOCUMENT_STORAGE_ROOT);
  const rootPrefix = `${normalizedRoot}${path.sep}`;

  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(rootPrefix)) {
    throw new Error("Resolved storage path is outside the document storage root.");
  }

  return absolutePath;
}

export async function storeDocumentFile(input: {
  companyId: string;
  documentId: string;
  userId: string | null;
  isCompanyWide: boolean;
  fileName: string;
  fileMimeType: string;
  fileBuffer: Buffer;
}) {
  const relativePath = buildScopedRelativePath(input);
  const supabaseClient = getSupabaseClient();

  if (supabaseClient) {
    const uploadResult = await supabaseClient.storage
      .from(supabaseConfig.documentBucket)
      .upload(relativePath, input.fileBuffer, {
        contentType: input.fileMimeType,
        upsert: false,
      });

    if (!uploadResult.error) {
      return {
        storageReference: `${SUPABASE_STORAGE_PREFIX}${supabaseConfig.documentBucket}/${relativePath}`,
        storageMethod: "supabase" as const,
      };
    }
  }

  const absolutePath = resolveLocalAbsolutePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.fileBuffer);

  return {
    storageReference: `${LOCAL_STORAGE_PREFIX}${relativePath}`,
    storageMethod: "local" as const,
  };
}

export async function readStoredDocumentFile(storageReference: string) {
  if (storageReference.startsWith(LOCAL_STORAGE_PREFIX)) {
    const relativePath = storageReference.slice(LOCAL_STORAGE_PREFIX.length);
    const absolutePath = resolveLocalAbsolutePath(relativePath);
    const buffer = await readFile(absolutePath);

    return {
      buffer,
      sourceUrl: storageReference,
    };
  }

  if (storageReference.startsWith(SUPABASE_STORAGE_PREFIX)) {
    const locator = storageReference.slice(SUPABASE_STORAGE_PREFIX.length);
    const [bucket, ...pathSegments] = locator.split("/").filter(Boolean);

    if (!bucket || pathSegments.length === 0) {
      throw new Error("Invalid Supabase document storage reference.");
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase storage is not configured for document access.");
    }

    const downloadResult = await client.storage
      .from(bucket)
      .download(pathSegments.join("/"));

    if (downloadResult.error || !downloadResult.data) {
      throw new Error("The stored document file could not be downloaded.");
    }

    const arrayBuffer = await downloadResult.data.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      sourceUrl: storageReference,
    };
  }

  let response: Response;

  try {
    response = await fetch(storageReference);
  } catch {
    throw new Error("The stored document file could not be opened right now.");
  }

  if (!response.ok) {
    throw new Error("The stored document file could not be found.");
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") ?? null,
    sourceUrl: response.url || storageReference,
  };
}

export async function deleteStoredDocumentFile(storageReference: string) {
  const trimmedReference = storageReference.trim();

  if (!trimmedReference || trimmedReference.startsWith("data:")) {
    return;
  }

  if (trimmedReference.startsWith(LOCAL_STORAGE_PREFIX)) {
    const relativePath = trimmedReference.slice(LOCAL_STORAGE_PREFIX.length);
    const absolutePath = resolveLocalAbsolutePath(relativePath);

    try {
      await unlink(absolutePath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }

    return;
  }

  if (trimmedReference.startsWith(SUPABASE_STORAGE_PREFIX)) {
    const locator = trimmedReference.slice(SUPABASE_STORAGE_PREFIX.length);
    const [bucket, ...pathSegments] = locator.split("/").filter(Boolean);

    if (!bucket || pathSegments.length === 0) {
      throw new Error("Invalid Supabase document storage reference.");
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase storage is not configured for document deletion.");
    }

    const removeResult = await client.storage
      .from(bucket)
      .remove([pathSegments.join("/")]);

    if (removeResult.error) {
      throw new Error("The stored document file could not be deleted.");
    }
  }
}
