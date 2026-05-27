import type { ValidationResult } from "../auth/auth.types.js";
import type {
  AttendanceCorrectionRequestType,
  CreateAttendanceCorrectionRequest,
  ReviewAttendanceCorrectionRequest,
} from "./attendance-corrections.types.js";

const REQUEST_TYPES: AttendanceCorrectionRequestType[] = [
  "missed_check_in",
  "missed_check_out",
  "full_day_missing",
  "correction",
];

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

function normalizeOptionalDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "invalid";
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "invalid" : text;
}

function normalizeOptionalDateTime(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "invalid";
  }

  return date.toISOString();
}

function isRequestType(value: string): value is AttendanceCorrectionRequestType {
  return REQUEST_TYPES.includes(value as AttendanceCorrectionRequestType);
}

export function validateCreateAttendanceCorrectionPayload(
  input: unknown,
): ValidationResult<CreateAttendanceCorrectionRequest> {
  if (!input || typeof input !== "object") {
    return fail("Attendance correction payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const attendanceId = normalizeText(payload.attendanceId) || undefined;
  const attendanceDate = normalizeOptionalDate(payload.attendanceDate);
  const requestTypeText = normalizeText(payload.requestType);
  const requestedCheckIn = normalizeOptionalDateTime(payload.requestedCheckIn);
  const requestedCheckOut = normalizeOptionalDateTime(payload.requestedCheckOut);
  const reason = normalizeText(payload.reason);
  const errors: string[] = [];

  if (!attendanceDate) {
    errors.push("Attendance date is required.");
  } else if (attendanceDate === "invalid") {
    errors.push("Attendance date must use YYYY-MM-DD format.");
  }

  if (!requestTypeText || !isRequestType(requestTypeText)) {
    errors.push(
      "Attendance request type must be missed_check_in, missed_check_out, full_day_missing, or correction.",
    );
  }

  if (requestedCheckIn === "invalid") {
    errors.push("Requested check-in must be a valid date-time.");
  }

  if (requestedCheckOut === "invalid") {
    errors.push("Requested check-out must be a valid date-time.");
  }

  if (reason.length < 5) {
    errors.push("Correction reason must be at least 5 characters long.");
  }

  const requestType = isRequestType(requestTypeText) ? requestTypeText : null;

  if (requestType === "missed_check_in" && typeof requestedCheckIn !== "string") {
    errors.push("Requested check-in is required for a missed check-in request.");
  }

  if (requestType === "missed_check_out" && typeof requestedCheckOut !== "string") {
    errors.push("Requested check-out is required for a missed check-out request.");
  }

  if (
    requestType === "full_day_missing" &&
    (typeof requestedCheckIn !== "string" || typeof requestedCheckOut !== "string")
  ) {
    errors.push(
      "Requested check-in and check-out are required for a full day missing request.",
    );
  }

  if (
    requestType === "correction" &&
    requestedCheckIn === null &&
    requestedCheckOut === null
  ) {
    errors.push("At least one requested attendance timestamp is required.");
  }

  if (
    typeof requestedCheckIn === "string" &&
    typeof requestedCheckOut === "string" &&
    new Date(requestedCheckOut).getTime() < new Date(requestedCheckIn).getTime()
  ) {
    errors.push("Requested check-out cannot be before requested check-in.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    attendanceId,
    attendanceDate,
    requestType: requestType as AttendanceCorrectionRequestType,
    requestedCheckIn: requestedCheckIn === "invalid" ? null : requestedCheckIn,
    requestedCheckOut: requestedCheckOut === "invalid" ? null : requestedCheckOut,
    reason,
  });
}

export function validateReviewAttendanceCorrectionPayload(
  input: unknown,
): ValidationResult<ReviewAttendanceCorrectionRequest> {
  if (!input || typeof input !== "object") {
    return fail("Attendance correction review payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const status = normalizeText(payload.status);
  const rejectionReason = normalizeText(payload.rejectionReason) || null;

  if (status !== "approved" && status !== "rejected") {
    return fail("Attendance correction review status must be approved or rejected.");
  }

  if (status === "rejected" && (!rejectionReason || rejectionReason.length < 3)) {
    return fail("Rejection reason must be at least 3 characters long.");
  }

  return success({
    status,
    rejectionReason,
  });
}
