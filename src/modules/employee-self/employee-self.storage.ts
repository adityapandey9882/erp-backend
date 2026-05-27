import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseConfig } from "../../config/supabase.config.js";

const LOCAL_STORAGE_PREFIX = "local://profile-photos/";
const SUPABASE_STORAGE_PREFIX = "supabase://";
const LOCAL_PROFILE_STORAGE_ROOT = path.resolve(
  process.cwd(),
  "storage",
  "profile-photos",
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

  return normalized || "profile-photo";
}

function buildScopedRelativePath(input: {
  companyId: string;
  userId: string;
  fileName: string;
}) {
  return [
    input.companyId,
    "users",
    input.userId,
    sanitizeStorageFileName(input.fileName),
  ].join("/");
}

function resolveLocalAbsolutePath(relativePath: string) {
  const segments = relativePath.split("/").filter(Boolean);
  const absolutePath = path.resolve(LOCAL_PROFILE_STORAGE_ROOT, ...segments);
  const normalizedRoot = path.resolve(LOCAL_PROFILE_STORAGE_ROOT);
  const rootPrefix = `${normalizedRoot}${path.sep}`;

  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(rootPrefix)) {
    throw new Error("Resolved profile storage path is outside the profile storage root.");
  }

  return absolutePath;
}

function inferMimeTypeFromReference(storageReference: string) {
  const normalized = storageReference.toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  return "image/jpeg";
}

export async function storeEmployeeProfilePhoto(input: {
  companyId: string;
  userId: string;
  fileName: string;
  fileMimeType: string;
  fileBuffer: Buffer;
}) {
  const relativePath = buildScopedRelativePath(input);
  const client = getSupabaseClient();

  if (client) {
    const uploadResult = await client.storage
      .from(supabaseConfig.documentBucket)
      .upload(relativePath, input.fileBuffer, {
        contentType: input.fileMimeType,
        upsert: true,
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

export async function readEmployeeProfilePhoto(storageReference: string) {
  if (storageReference.startsWith(LOCAL_STORAGE_PREFIX)) {
    const relativePath = storageReference.slice(LOCAL_STORAGE_PREFIX.length);
    const absolutePath = resolveLocalAbsolutePath(relativePath);

    return {
      buffer: await readFile(absolutePath),
      mimeType: inferMimeTypeFromReference(storageReference),
    };
  }

  if (storageReference.startsWith(SUPABASE_STORAGE_PREFIX)) {
    const locator = storageReference.slice(SUPABASE_STORAGE_PREFIX.length);
    const [bucket, ...pathSegments] = locator.split("/").filter(Boolean);

    if (!bucket || pathSegments.length === 0) {
      throw new Error("Invalid Supabase profile photo storage reference.");
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase storage is not configured for profile photo access.");
    }

    const downloadResult = await client.storage
      .from(bucket)
      .download(pathSegments.join("/"));

    if (downloadResult.error || !downloadResult.data) {
      throw new Error("The stored profile photo could not be downloaded.");
    }

    const arrayBuffer = await downloadResult.data.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: inferMimeTypeFromReference(storageReference),
    };
  }

  let response: Response;

  try {
    response = await fetch(storageReference);
  } catch {
    throw new Error("The stored profile photo could not be opened right now.");
  }

  if (!response.ok) {
    throw new Error("The stored profile photo could not be found.");
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType:
      response.headers.get("content-type") ??
      inferMimeTypeFromReference(storageReference),
  };
}

export async function deleteEmployeeProfilePhoto(storageReference: string) {
  const trimmedReference = storageReference.trim();

  if (!trimmedReference) {
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
      throw new Error("Invalid Supabase profile photo storage reference.");
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase storage is not configured for profile photo deletion.");
    }

    const removeResult = await client.storage
      .from(bucket)
      .remove([pathSegments.join("/")]);

    if (removeResult.error) {
      throw new Error("The stored profile photo could not be deleted.");
    }
  }
}
