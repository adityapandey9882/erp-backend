import type { ValidationResult } from "../auth/auth.types.js";
import {
  isCompanyOnboardingStatus,
  isCompanyStatus,
  normalizeCompanyModules,
  type AssignCompanyAdminRequest,
  type CreateCompanyRequest,
  type UpdateCompanyLogoRequest,
  type UpdateCompanyModulesRequest,
  type UpdateCompanyRequest,
  type UpdateCompanyStatusRequest,
} from "./companies.types.js";

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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLogoValue(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)
  );
}

function validateCompanyInput(
  input: unknown,
): ValidationResult<CreateCompanyRequest | UpdateCompanyRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company payload is required.");
  }

  const name = normalizeString((input as Record<string, unknown>).name);
  const code = normalizeString((input as Record<string, unknown>).code).toUpperCase();
  const industry = normalizeString((input as Record<string, unknown>).industry);
  const contactEmail = normalizeString(
    (input as Record<string, unknown>).contactEmail,
  ).toLowerCase();

  if (!name || name.length < 2) {
    return fail("Company name must be at least 2 characters long.");
  }

  if (!code || code.length < 2) {
    return fail("Company code must be at least 2 characters long.");
  }

  if (!/^[A-Z0-9-]+$/.test(code)) {
    return fail("Company code must contain only letters, numbers, or hyphens.");
  }

  if (!industry || industry.length < 2) {
    return fail("Industry is required.");
  }

  if (!contactEmail || !isEmail(contactEmail)) {
    return fail("A valid contact email is required.");
  }

  return success({
    name,
    code,
    industry,
    contactEmail,
  });
}

export function validateCreateCompanyPayload(
  input: unknown,
): ValidationResult<CreateCompanyRequest> {
  return validateCompanyInput(input);
}

export function validateUpdateCompanyPayload(
  input: unknown,
): ValidationResult<UpdateCompanyRequest> {
  const result = validateCompanyInput(input);

  if (!result.success) {
    return result;
  }

  const onboardingStatus = normalizeString(
    (input as Record<string, unknown>).onboardingStatus,
  );

  if (!isCompanyOnboardingStatus(onboardingStatus)) {
    return fail("A valid onboarding status is required.");
  }

  return success({
    ...result.data,
    onboardingStatus,
  });
}

export function validateUpdateCompanyStatusPayload(
  input: unknown,
): ValidationResult<UpdateCompanyStatusRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company status payload is required.");
  }

  const status = normalizeString((input as Record<string, unknown>).status);

  if (!isCompanyStatus(status)) {
    return fail("A valid company status is required.");
  }

  return success({ status });
}

export function validateUpdateCompanyLogoPayload(
  input: unknown,
): ValidationResult<UpdateCompanyLogoRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company logo payload is required.");
  }

  const rawValue = (input as Record<string, unknown>).logoUrl;
  const logoUrl =
    rawValue === null || typeof rawValue === "undefined"
      ? null
      : normalizeString(rawValue);

  if (logoUrl && !isLogoValue(logoUrl)) {
    return fail("Provide a valid HTTPS image URL or image data URL.");
  }

  return success({
    logoUrl: logoUrl || null,
  });
}

export function validateAssignCompanyAdminPayload(
  input: unknown,
): ValidationResult<AssignCompanyAdminRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company admin assignment payload is required.");
  }

  const adminUserId = normalizeString(
    (input as Record<string, unknown>).adminUserId,
  );

  if (!adminUserId) {
    return fail("An admin user identifier is required.");
  }

  return success({ adminUserId });
}

export function validateUpdateCompanyModulesPayload(
  input: unknown,
): ValidationResult<UpdateCompanyModulesRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company module payload is required.");
  }

  const enabledModules = Array.isArray(
    (input as Record<string, unknown>).enabledModules,
  )
    ? normalizeCompanyModules(
        ((input as Record<string, unknown>).enabledModules as unknown[]).map(
          (value) => normalizeString(value),
        ),
      )
    : [];

  return success({ enabledModules });
}
