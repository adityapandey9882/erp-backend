import type { ValidationResult } from "../auth/auth.types.js";
import type {
  CreateEmployeeLeaveRequest,
  UpdateManagerLeaveStatusRequest,
  UpdateHrLeaveStatusRequest,
} from "./leave.types.js";
import {
  isHrReviewableLeaveStatus,
  isManagerReviewAction,
} from "./leave.types.js";

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

function isDateOnlyString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

export function validateCreateEmployeeLeavePayload(
  input: unknown,
): ValidationResult<CreateEmployeeLeaveRequest> {
  if (!input || typeof input !== "object") {
    return fail("Leave request payload is required.");
  }

  const startDate = normalizeText((input as Record<string, unknown>).startDate);
  const endDate = normalizeText((input as Record<string, unknown>).endDate);
  const leaveType = normalizeText((input as Record<string, unknown>).leaveType);
  const reason = normalizeText((input as Record<string, unknown>).reason);
  const errors: string[] = [];

  if (!isDateOnlyString(startDate)) {
    errors.push("A valid leave start date is required.");
  }

  if (!isDateOnlyString(endDate)) {
    errors.push("A valid leave end date is required.");
  }

  if (isDateOnlyString(startDate) && isDateOnlyString(endDate) && endDate < startDate) {
    errors.push("Leave end date cannot be before the start date.");
  }

  if (!leaveType) {
    errors.push("Leave type is required.");
  } else if (leaveType.length > 80) {
    errors.push("Leave type must be 80 characters or fewer.");
  }

  if (!reason) {
    errors.push("Leave reason is required.");
  } else if (reason.length > 2000) {
    errors.push("Leave reason must be 2000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    startDate,
    endDate,
    leaveType,
    reason,
  });
}

export function validateUpdateHrLeaveStatusPayload(
  input: unknown,
): ValidationResult<UpdateHrLeaveStatusRequest> {
  if (!input || typeof input !== "object") {
    return fail("Leave status payload is required.");
  }

  const status = normalizeText((input as Record<string, unknown>).status);
  const remarks = normalizeText((input as Record<string, unknown>).remarks);

  if (!isHrReviewableLeaveStatus(status)) {
    return fail("Leave status must be approved or rejected.");
  }

  if (remarks.length > 2000) {
    return fail("Leave review remarks must be 2000 characters or fewer.");
  }

  return success({
    status,
    remarks: remarks || null,
  });
}

export function validateUpdateManagerLeaveStatusPayload(
  input: unknown,
): ValidationResult<UpdateManagerLeaveStatusRequest> {
  if (!input || typeof input !== "object") {
    return fail("Manager review payload is required.");
  }

  const status = normalizeText((input as Record<string, unknown>).status);

  if (!isManagerReviewAction(status)) {
    return fail("Manager review status must be approved, forwarded, or rejected.");
  }

  return success({
    status,
  });
}
