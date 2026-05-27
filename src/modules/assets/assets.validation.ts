import type { ValidationResult } from "../auth/auth.types.js";
import type {
  AssignAssetRequest,
  CreateAssetEventRequest,
  CreateAssetProcurementRequest,
  CreateAssetRequest,
  UpdateAssetStatusRequest,
  UpdateAssetRequest,
} from "./assets.types.js";
import { isAssetStatus, isManualAssetEventType } from "./assets.types.js";

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

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeString(value).toLowerCase();

  return isAssetStatus(normalized) ? normalized : null;
}

function validateAssetLikePayload(
  input: unknown,
  mode: "create" | "update",
): ValidationResult<CreateAssetRequest | UpdateAssetRequest> {
  if (!input || typeof input !== "object") {
    return fail("Asset payload is required.");
  }

  const assetCode = normalizeString((input as Record<string, unknown>).assetCode);
  const name = normalizeString((input as Record<string, unknown>).name);
  const category = normalizeString((input as Record<string, unknown>).category);
  const serialNumber = normalizeOptionalString(
    (input as Record<string, unknown>).serialNumber,
  );
  const brandModel = normalizeOptionalString(
    (input as Record<string, unknown>).brandModel,
  );
  const purchaseDate =
    "purchaseDate" in (input as Record<string, unknown>)
      ? parseDateOnly((input as Record<string, unknown>).purchaseDate)
      : null;
  const warrantyExpiry =
    "warrantyExpiry" in (input as Record<string, unknown>)
      ? parseDateOnly((input as Record<string, unknown>).warrantyExpiry)
      : null;
  const conditionLabel =
    normalizeOptionalString((input as Record<string, unknown>).conditionLabel) ??
    "Good";
  const status = normalizeStatus((input as Record<string, unknown>).status);
  const notes = normalizeOptionalString((input as Record<string, unknown>).notes);

  if (!assetCode || assetCode.length < 2) {
    return fail("Asset code must be at least 2 characters long.");
  }

  if (!name || name.length < 2) {
    return fail("Asset name must be at least 2 characters long.");
  }

  if (!category || category.length < 2) {
    return fail("Asset category must be at least 2 characters long.");
  }

  if (mode === "update" && !status) {
    return fail("Asset status is required.");
  }

  if (status && !isAssetStatus(status)) {
    return fail("Asset status is invalid.");
  }

  if (
    "purchaseDate" in (input as Record<string, unknown>) &&
    (input as Record<string, unknown>).purchaseDate !== null &&
    (input as Record<string, unknown>).purchaseDate !== undefined &&
    !purchaseDate
  ) {
    return fail("Purchase date must use YYYY-MM-DD format.");
  }

  if (
    "warrantyExpiry" in (input as Record<string, unknown>) &&
    (input as Record<string, unknown>).warrantyExpiry !== null &&
    (input as Record<string, unknown>).warrantyExpiry !== undefined &&
    !warrantyExpiry
  ) {
    return fail("Warranty expiry must use YYYY-MM-DD format.");
  }

  if (purchaseDate && isFutureDate(purchaseDate)) {
    return fail("Purchase date cannot be in the future.");
  }

  if (purchaseDate && warrantyExpiry && warrantyExpiry < purchaseDate) {
    return fail("Warranty expiry cannot be earlier than purchase date.");
  }

  return success({
    assetCode,
    name,
    category,
    serialNumber,
    brandModel,
    purchaseDate,
    warrantyExpiry,
    conditionLabel,
    notes,
    ...(status ? { status } : {}),
  } as CreateAssetRequest | UpdateAssetRequest);
}

function parseDateOnly(value: unknown) {
  const normalized = normalizeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

function isFutureDate(value: string) {
  const today = new Date().toISOString().slice(0, 10);

  return value > today;
}

function parsePositiveInteger(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function parseNonNegativeAmount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Number(numeric.toFixed(2));
}

export function validateCreateAssetPayload(
  input: unknown,
): ValidationResult<CreateAssetRequest> {
  return validateAssetLikePayload(
    input,
    "create",
  ) as ValidationResult<CreateAssetRequest>;
}

export function validateUpdateAssetPayload(
  input: unknown,
): ValidationResult<UpdateAssetRequest> {
  return validateAssetLikePayload(
    input,
    "update",
  ) as ValidationResult<UpdateAssetRequest>;
}

export function validateAssignAssetPayload(
  input: unknown,
): ValidationResult<AssignAssetRequest> {
  if (!input || typeof input !== "object") {
    return fail("Asset assignment payload is required.");
  }

  const userId = normalizeString((input as Record<string, unknown>).userId);
  const expectedReturnDate =
    "expectedReturnDate" in (input as Record<string, unknown>)
      ? parseDateOnly((input as Record<string, unknown>).expectedReturnDate)
      : null;
  const conditionAtAssignment = normalizeOptionalString(
    (input as Record<string, unknown>).conditionAtAssignment,
  );
  const notes = normalizeOptionalString((input as Record<string, unknown>).notes);

  if (!userId) {
    return fail("An employee identifier is required.");
  }

  if (
    "expectedReturnDate" in (input as Record<string, unknown>) &&
    (input as Record<string, unknown>).expectedReturnDate !== null &&
    (input as Record<string, unknown>).expectedReturnDate !== undefined &&
    !expectedReturnDate
  ) {
    return fail("Expected return date must use YYYY-MM-DD format.");
  }

  if (expectedReturnDate && expectedReturnDate < new Date().toISOString().slice(0, 10)) {
    return fail("Expected return date cannot be in the past.");
  }

  return success({
    userId,
    expectedReturnDate,
    conditionAtAssignment,
    notes,
  });
}

export function validateCreateAssetEventPayload(
  input: unknown,
): ValidationResult<CreateAssetEventRequest> {
  if (!input || typeof input !== "object") {
    return fail("Asset event payload is required.");
  }

  const type = normalizeString((input as Record<string, unknown>).type).toLowerCase();
  const notes = normalizeString((input as Record<string, unknown>).notes);

  if (!isManualAssetEventType(type)) {
    return fail("Only maintenance and note-added asset events can be created manually.");
  }

  if (!notes || notes.length < 2) {
    return fail("Lifecycle event notes must be at least 2 characters long.");
  }

  return success({
    type,
    notes,
  });
}

export function validateUpdateAssetStatusPayload(
  input: unknown,
): ValidationResult<UpdateAssetStatusRequest> {
  if (!input || typeof input !== "object") {
    return fail("Asset status payload is required.");
  }

  const status = normalizeStatus((input as Record<string, unknown>).status);

  if (!status) {
    return fail("A valid asset status is required.");
  }

  const data: UpdateAssetStatusRequest = { status };

  if ("notes" in (input as Record<string, unknown>)) {
    data.notes = normalizeOptionalString(
      (input as Record<string, unknown>).notes,
    );
  }

  return success(data);
}

export function validateCreateAssetProcurementPayload(
  input: unknown,
): ValidationResult<CreateAssetProcurementRequest> {
  if (!input || typeof input !== "object") {
    return fail("Procurement payload is required.");
  }

  const vendorName = normalizeString((input as Record<string, unknown>).vendorName);
  const invoiceNumber = normalizeOptionalString(
    (input as Record<string, unknown>).invoiceNumber,
  );
  const purchaseDate = parseDateOnly(
    (input as Record<string, unknown>).purchaseDate,
  );
  const notes = normalizeOptionalString((input as Record<string, unknown>).notes);
  const rawItems = (input as Record<string, unknown>).items;

  if (!vendorName || vendorName.length < 2) {
    return fail("Vendor name must be at least 2 characters long.");
  }

  if (!purchaseDate) {
    return fail("A valid purchase date is required.");
  }

  if (isFutureDate(purchaseDate)) {
    return fail("Purchase date cannot be in the future.");
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return fail("At least one procurement item is required.");
  }

  const itemErrors: string[] = [];
  const items = rawItems
    .map((rawItem, index) => {
      if (!rawItem || typeof rawItem !== "object") {
        itemErrors.push(`Procurement item ${index + 1} is invalid.`);
        return null;
      }

      const name = normalizeString((rawItem as Record<string, unknown>).name);
      const category = normalizeString((rawItem as Record<string, unknown>).category);
      const quantity = parsePositiveInteger(
        (rawItem as Record<string, unknown>).quantity,
      );
      const unitPrice = parseNonNegativeAmount(
        (rawItem as Record<string, unknown>).unitPrice,
      );

      if (!name || name.length < 2) {
        itemErrors.push(
          `Procurement item ${index + 1} name must be at least 2 characters long.`,
        );
      }

      if (!category || category.length < 2) {
        itemErrors.push(
          `Procurement item ${index + 1} category must be at least 2 characters long.`,
        );
      }

      if (!quantity) {
        itemErrors.push(
          `Procurement item ${index + 1} quantity must be a positive integer.`,
        );
      }

      if (unitPrice === null) {
        itemErrors.push(
          `Procurement item ${index + 1} unit price must be zero or greater.`,
        );
      }

      if (!name || !category || !quantity || unitPrice === null) {
        return null;
      }

      return {
        name,
        category,
        quantity,
        unitPrice,
      };
    })
    .filter(
      (item): item is CreateAssetProcurementRequest["items"][number] => item !== null,
    );

  if (itemErrors.length > 0) {
    return fail(...itemErrors);
  }

  return success({
    vendorName,
    invoiceNumber,
    purchaseDate,
    notes,
    items,
  });
}
