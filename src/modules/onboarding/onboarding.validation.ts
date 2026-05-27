import type { ValidationResult } from "../auth/auth.types.js";
import {
  isEmployeeProfileEmploymentType,
} from "../employee-self/employee-self.types.js";
import type {
  CreateOnboardingRequest,
  ReviewOnboardingRequest,
  TriggerOnboardingRequestAction,
  UpdateOnboardingRequestDetails,
} from "./onboarding.types.js";

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

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateCreateOnboardingRequestPayload(
  input: unknown,
): ValidationResult<CreateOnboardingRequest> {
  if (!input || typeof input !== "object") {
    return fail("Onboarding request payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const userId = normalizeText(payload.userId);
  const personalEmail = normalizeText(payload.personalEmail).toLowerCase();
  const phone = normalizeText(payload.phone);
  const departmentId = normalizeText(payload.departmentId);
  const designationId = normalizeText(payload.designationId);
  const reportingManagerId = normalizeText(payload.reportingManagerId);
  const joiningDate = normalizeText(payload.joiningDate);
  const employmentType = normalizeText(payload.employmentType);

  if (!userId) {
    return fail("A target employee is required.");
  }

  if (!isUuidLike(userId)) {
    return fail("A valid employee identifier is required.");
  }

  if (!personalEmail || !isEmail(personalEmail)) {
    return fail("A valid personal email address is required.");
  }

  if (!phone || !isPhoneNumber(phone)) {
    return fail("A valid phone number is required.");
  }

  if (!departmentId || !isUuidLike(departmentId)) {
    return fail("A valid department is required.");
  }

  if (!designationId || !isUuidLike(designationId)) {
    return fail("A valid designation is required.");
  }

  if (!reportingManagerId || !isUuidLike(reportingManagerId)) {
    return fail("A valid reporting manager is required.");
  }

  if (!joiningDate || !isDateOnly(joiningDate)) {
    return fail("Joining date must use the YYYY-MM-DD format.");
  }

  if (!employmentType || !isEmployeeProfileEmploymentType(employmentType)) {
    return fail("Employment type must match a supported employee employment type.");
  }

  return success({
    userId,
    personalEmail,
    phone,
    departmentId,
    designationId,
    reportingManagerId,
    joiningDate,
    employmentType,
  });
}

export function validateReviewOnboardingRequestPayload(
  input: unknown,
): ValidationResult<ReviewOnboardingRequest> {
  if (!input || typeof input !== "object") {
    return fail("Onboarding review payload is required.");
  }

  const status = normalizeText((input as Record<string, unknown>).status);

  if (status !== "approved" && status !== "rejected") {
    return fail("Onboarding review status must be approved or rejected.");
  }

  return success({
    status,
  });
}

export function validateUpdateOnboardingRequestDetailsPayload(
  input: unknown,
): ValidationResult<UpdateOnboardingRequestDetails> {
  if (!input || typeof input !== "object") {
    return fail("Onboarding details payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const personalEmail = normalizeOptionalText(payload.personalEmail);
  const phone = normalizeOptionalText(payload.phone);
  const departmentId = normalizeOptionalText(payload.departmentId);
  const designationId = normalizeOptionalText(payload.designationId);
  const reportingManagerId = normalizeOptionalText(payload.reportingManagerId);
  const joiningDate = normalizeOptionalText(payload.joiningDate);
  const employmentType = normalizeOptionalText(payload.employmentType);

  if (
    personalEmail === undefined &&
    phone === undefined &&
    departmentId === undefined &&
    designationId === undefined &&
    reportingManagerId === undefined &&
    joiningDate === undefined &&
    employmentType === undefined
  ) {
    return fail("At least one onboarding detail change is required.");
  }

  if (personalEmail !== undefined && personalEmail !== null && !isEmail(personalEmail)) {
    return fail("A valid personal email address is required.");
  }

  if (phone !== undefined && phone !== null && !isPhoneNumber(phone)) {
    return fail("A valid phone number is required.");
  }

  if (departmentId !== undefined && departmentId !== null && !isUuidLike(departmentId)) {
    return fail("A valid department is required.");
  }

  if (
    designationId !== undefined &&
    designationId !== null &&
    !isUuidLike(designationId)
  ) {
    return fail("A valid designation is required.");
  }

  if (
    reportingManagerId !== undefined &&
    reportingManagerId !== null &&
    !isUuidLike(reportingManagerId)
  ) {
    return fail("A valid reporting manager is required.");
  }

  if (joiningDate !== undefined && joiningDate !== null && !isDateOnly(joiningDate)) {
    return fail("Joining date must use the YYYY-MM-DD format.");
  }

  if (
    employmentType !== undefined &&
    employmentType !== null &&
    !isEmployeeProfileEmploymentType(employmentType)
  ) {
    return fail("Employment type must match a supported employee employment type.");
  }

  return success({
    personalEmail,
    phone,
    departmentId,
    designationId,
    reportingManagerId,
    joiningDate,
    employmentType,
  });
}

export function validateTriggerOnboardingRequestActionPayload(
  input: unknown,
): ValidationResult<TriggerOnboardingRequestAction> {
  if (!input || typeof input !== "object") {
    return fail("Onboarding action payload is required.");
  }

  const action = normalizeText((input as Record<string, unknown>).action);

  if (
    action !== "send-reminder" &&
    action !== "send-upload-link" &&
    action !== "request-document"
  ) {
    return fail(
      "Onboarding action must be send-reminder, send-upload-link, or request-document.",
    );
  }

  return success({
    action,
  });
}
