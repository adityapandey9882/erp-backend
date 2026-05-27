import type { ValidationResult } from "../auth/auth.types.js";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "../departments/departments.types.js";
import type {
  CreateDesignationRequest,
  UpdateDesignationRequest,
} from "../designations/designations.types.js";

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

function normalizeCode(value: unknown) {
  return normalizeString(value).toUpperCase();
}

function normalizeOptionalDepartmentId(value: unknown) {
  const normalized = normalizeString(value);

  return normalized.length > 0 ? normalized : null;
}

function validateDepartmentLikeInput(
  input: unknown,
): ValidationResult<CreateDepartmentRequest | UpdateDepartmentRequest> {
  if (!input || typeof input !== "object") {
    return fail("Department payload is required.");
  }

  const name = normalizeString((input as Record<string, unknown>).name);
  const code = normalizeCode((input as Record<string, unknown>).code);
  const description = normalizeOptionalString(
    (input as Record<string, unknown>).description,
  );

  if (!name || name.length < 2) {
    return fail("Department name must be at least 2 characters long.");
  }

  if (!code || code.length < 2) {
    return fail("Department code must be at least 2 characters long.");
  }

  return success({
    name,
    code,
    description,
  });
}

function validateDesignationLikeInput(
  input: unknown,
): ValidationResult<CreateDesignationRequest | UpdateDesignationRequest> {
  if (!input || typeof input !== "object") {
    return fail("Designation payload is required.");
  }

  const title = normalizeString((input as Record<string, unknown>).title);
  const code = normalizeCode((input as Record<string, unknown>).code);
  const description = normalizeOptionalString(
    (input as Record<string, unknown>).description,
  );
  const departmentId = normalizeOptionalDepartmentId(
    (input as Record<string, unknown>).departmentId,
  );

  if (!title || title.length < 2) {
    return fail("Designation title must be at least 2 characters long.");
  }

  if (!code || code.length < 2) {
    return fail("Designation code must be at least 2 characters long.");
  }

  return success({
    title,
    code,
    description,
    departmentId,
  });
}

export function validateCreateDepartmentPayload(
  input: unknown,
): ValidationResult<CreateDepartmentRequest> {
  return validateDepartmentLikeInput(input) as ValidationResult<CreateDepartmentRequest>;
}

export function validateUpdateDepartmentPayload(
  input: unknown,
): ValidationResult<UpdateDepartmentRequest> {
  return validateDepartmentLikeInput(input) as ValidationResult<UpdateDepartmentRequest>;
}

export function validateCreateDesignationPayload(
  input: unknown,
): ValidationResult<CreateDesignationRequest> {
  return validateDesignationLikeInput(input) as ValidationResult<CreateDesignationRequest>;
}

export function validateUpdateDesignationPayload(
  input: unknown,
): ValidationResult<UpdateDesignationRequest> {
  return validateDesignationLikeInput(input) as ValidationResult<UpdateDesignationRequest>;
}
