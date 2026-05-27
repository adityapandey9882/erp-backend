import type { ValidationResult } from "../auth/auth.types.js";
import type {
  CreatePayrollRunRequest,
  CreateSalaryStructureRequest,
  UpdateSalaryStructureRequest,
} from "./payroll.types.js";
import { isSalaryStructureStatus } from "./payroll.types.js";

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

function normalizeCurrencyCode(value: unknown) {
  return normalizeString(value).toUpperCase();
}

function normalizeBaseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

function validateStructureLikePayload(
  input: unknown,
): ValidationResult<CreateSalaryStructureRequest | UpdateSalaryStructureRequest> {
  if (!input || typeof input !== "object") {
    return fail("Salary structure payload is required.");
  }

  const baseAmount = normalizeBaseAmount(
    (input as Record<string, unknown>).baseAmount,
  );
  const currencyCode = normalizeCurrencyCode(
    (input as Record<string, unknown>).currencyCode,
  );
  const status = normalizeString((input as Record<string, unknown>).status);

  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return fail("Base amount must be a positive number.");
  }

  if (currencyCode.length !== 3) {
    return fail("Currency code must be a 3-letter code.");
  }

  if (!isSalaryStructureStatus(status)) {
    return fail("Salary structure status must be active or inactive.");
  }

  return success({
    baseAmount,
    currencyCode,
    status,
  });
}

export function validateCreateSalaryStructurePayload(
  input: unknown,
): ValidationResult<CreateSalaryStructureRequest> {
  const base = validateStructureLikePayload(input);

  if (!base.success) {
    return base as ValidationResult<CreateSalaryStructureRequest>;
  }

  const designationId = normalizeString(
    (input as Record<string, unknown>).designationId,
  );

  if (!designationId) {
    return fail("Designation is required for a salary structure.");
  }

  return success({
    designationId,
    ...base.data,
  });
}

export function validateUpdateSalaryStructurePayload(
  input: unknown,
): ValidationResult<UpdateSalaryStructureRequest> {
  return validateStructureLikePayload(
    input,
  ) as ValidationResult<UpdateSalaryStructureRequest>;
}

export function validateCreatePayrollRunPayload(
  input: unknown,
): ValidationResult<CreatePayrollRunRequest> {
  if (!input || typeof input !== "object") {
    return fail("Payroll run payload is required.");
  }

  const rawMonth = (input as Record<string, unknown>).month;
  const rawYear = (input as Record<string, unknown>).year;
  const month =
    typeof rawMonth === "number" ? rawMonth : Number(normalizeString(rawMonth));
  const year =
    typeof rawYear === "number" ? rawYear : Number(normalizeString(rawYear));

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return fail("Payroll month must be an integer from 1 to 12.");
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fail("Payroll year must be an integer from 2000 to 2100.");
  }

  return success({
    month,
    year,
  });
}
