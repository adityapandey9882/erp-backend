import type { ValidationResult } from "../auth/auth.types.js";
import {
  OFFBOARDING_EXIT_TYPES,
  type CreateOffboardingRequest,
  type ReviewOffboardingRequest,
  type TriggerOffboardingRequestAction,
  type UpdateOffboardingRequestDetails,
} from "./offboarding.types.js";

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

function normalizeOptionalText(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return undefined;
}

function isExitType(value: string): value is CreateOffboardingRequest["exitType"] {
  return OFFBOARDING_EXIT_TYPES.includes(
    value as CreateOffboardingRequest["exitType"],
  );
}

function validateCreatePayload(
  input: unknown,
): ValidationResult<CreateOffboardingRequest> {
  if (!input || typeof input !== "object") {
    return fail("Offboarding request payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const userId = normalizeText(payload.userId);
  const departmentId = normalizeText(payload.departmentId);
  const designationId = normalizeText(payload.designationId);
  const reportingManagerId = normalizeText(payload.reportingManagerId);
  const exitType = normalizeText(payload.exitType);
  const resignationDate = normalizeText(payload.resignationDate);
  const lastWorkingDate = normalizeText(payload.lastWorkingDate);
  const reason = normalizeOptionalText(payload.reason);
  const noticePeriodDays = normalizeOptionalNumber(payload.noticePeriodDays);

  if (!userId) {
    return fail("A target employee identifier is required.");
  }

  if (!departmentId) {
    return fail("A department is required.");
  }

  if (!designationId) {
    return fail("A designation is required.");
  }

  if (!reportingManagerId) {
    return fail("A reporting manager is required.");
  }

  if (!isExitType(exitType)) {
    return fail("A valid exit type is required.");
  }

  if (!resignationDate) {
    return fail("A resignation date is required.");
  }

  if (!lastWorkingDate) {
    return fail("A last working date is required.");
  }

  if (
    typeof noticePeriodDays !== "number" ||
    !Number.isInteger(noticePeriodDays) ||
    noticePeriodDays < 0
  ) {
    return fail("Notice period days must be a whole number greater than or equal to zero.");
  }

  return success({
    userId,
    departmentId,
    designationId,
    reportingManagerId,
    exitType,
    resignationDate,
    lastWorkingDate,
    noticePeriodDays,
    reason,
  });
}

function validateReviewPayload(
  input: unknown,
): ValidationResult<ReviewOffboardingRequest> {
  if (!input || typeof input !== "object") {
    return fail("Offboarding review payload is required.");
  }

  const status = normalizeText((input as Record<string, unknown>).status);

  if (status !== "approved" && status !== "rejected") {
    return fail("Offboarding review status must be approved or rejected.");
  }

  return success({
    status,
  });
}

function validateUpdateDetailsPayload(
  input: unknown,
): ValidationResult<UpdateOffboardingRequestDetails> {
  if (!input || typeof input !== "object") {
    return fail("Offboarding details payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const departmentId = normalizeOptionalText(payload.departmentId);
  const designationId = normalizeOptionalText(payload.designationId);
  const reportingManagerId = normalizeOptionalText(payload.reportingManagerId);
  const exitType = normalizeOptionalText(payload.exitType);
  const resignationDate = normalizeOptionalText(payload.resignationDate);
  const lastWorkingDate = normalizeOptionalText(payload.lastWorkingDate);
  const noticePeriodDays = normalizeOptionalNumber(payload.noticePeriodDays);
  const reason = normalizeOptionalText(payload.reason);

  if (
    exitType !== undefined &&
    exitType !== null &&
    !isExitType(exitType)
  ) {
    return fail("Offboarding exit type is invalid.");
  }

  if (
    noticePeriodDays !== undefined &&
    noticePeriodDays !== null &&
    (!Number.isInteger(noticePeriodDays) || noticePeriodDays < 0)
  ) {
    return fail("Notice period days must be a whole number greater than or equal to zero.");
  }

  return success({
    departmentId,
    designationId,
    reportingManagerId,
    exitType: exitType ?? undefined,
    resignationDate,
    lastWorkingDate,
    noticePeriodDays,
    reason,
  });
}

function validateTriggerActionPayload(
  input: unknown,
): ValidationResult<TriggerOffboardingRequestAction> {
  if (!input || typeof input !== "object") {
    return fail("Offboarding action payload is required.");
  }

  const action = normalizeText((input as Record<string, unknown>).action);

  if (action !== "send-reminder" && action !== "generate-letters") {
    return fail("Offboarding action must be send-reminder or generate-letters.");
  }

  return success({
    action,
  });
}

export function validateCreateOffboardingRequestPayload(input: unknown) {
  return validateCreatePayload(input);
}

export function validateReviewOffboardingRequestPayload(input: unknown) {
  return validateReviewPayload(input);
}

export function validateUpdateOffboardingRequestDetailsPayload(input: unknown) {
  return validateUpdateDetailsPayload(input);
}

export function validateTriggerOffboardingRequestActionPayload(input: unknown) {
  return validateTriggerActionPayload(input);
}
