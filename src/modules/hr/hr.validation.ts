import type { ValidationResult } from "../auth/auth.types.js";
import type {
  ImportHrEmployeesRequest,
  ImportHrEmployeeRowRequest,
  UpdateHrEmployeeProfileRequest,
} from "./hr.types.js";

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

function normalizeOptionalId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImportRow(
  input: unknown,
  index: number,
): ImportHrEmployeeRowRequest | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const payload = input as Record<string, unknown>;
  const rowNumberValue = Number(payload.rowNumber);
  const rowNumber =
    Number.isInteger(rowNumberValue) && rowNumberValue > 0
      ? rowNumberValue
      : index + 2;

  return {
    rowNumber,
    fullName: normalizeString(payload.fullName),
    email: normalizeString(payload.email).toLowerCase(),
    password: normalizeString(payload.password),
    role: normalizeString(payload.role),
    status: normalizeString(payload.status).toLowerCase(),
  };
}

export function validateUpdateHrEmployeeProfilePayload(
  input: unknown,
): ValidationResult<UpdateHrEmployeeProfileRequest> {
  if (!input || typeof input !== "object") {
    return fail("Employee profile payload is required.");
  }

  return success({
    departmentId: normalizeOptionalId(
      (input as Record<string, unknown>).departmentId,
    ),
    designationId: normalizeOptionalId(
      (input as Record<string, unknown>).designationId,
    ),
  });
}

export function validateImportHrEmployeesPayload(
  input: unknown,
): ValidationResult<ImportHrEmployeesRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Employee import payload is required.");
  }

  const rawRows = Array.isArray((input as Record<string, unknown>).rows)
    ? ((input as Record<string, unknown>).rows as unknown[])
    : [];

  if (rawRows.length === 0) {
    return fail("Import payload must include at least one employee row.");
  }

  if (rawRows.length > 200) {
    return fail("A maximum of 200 employee rows can be imported in one request.");
  }

  const rows = rawRows.map((row, index) => normalizeImportRow(row, index));

  if (rows.some((row) => row === null)) {
    return fail("Each import row must be a valid object.");
  }

  return success({
    rows: rows.filter(
      (row): row is ImportHrEmployeeRowRequest => row !== null,
    ),
  });
}
