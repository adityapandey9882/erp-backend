import type { ValidationResult } from "../auth/auth.types.js";
import type {
  AttendanceQrAction,
  AttendanceModeKey,
  CreateAttendanceQrSessionRequest,
  EmployeeAttendancePunchRequest,
  VerifyAttendanceQrSessionRequest,
} from "./attendance.types.js";

const MODE_VALUES: AttendanceModeKey[] = ["office", "remote", "field-visit"];
const QR_ACTION_VALUES: AttendanceQrAction[] = ["check_in", "check_out"];

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

function normalizeNullableString(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAttendanceModeKey(value: string): value is AttendanceModeKey {
  return MODE_VALUES.includes(value as AttendanceModeKey);
}

function isAttendanceQrAction(value: string): value is AttendanceQrAction {
  return QR_ACTION_VALUES.includes(value as AttendanceQrAction);
}

function normalizeAttendanceMode(value: unknown): AttendanceModeKey | null {
  const mode = normalizeText(value);

  if (mode === "field" || mode === "site") {
    return "field-visit";
  }

  return isAttendanceModeKey(mode) ? mode : null;
}

function validateCoordinate(
  value: number | null,
  min: number,
  max: number,
  label: string,
) {
  if (value === null) {
    return null;
  }

  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }

  return null;
}

export function validateAttendancePunchPayload(
  input: unknown,
): ValidationResult<EmployeeAttendancePunchRequest> {
  if (!input || typeof input !== "object") {
    return fail("Attendance punch payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const mode = normalizeAttendanceMode(payload.mode);
  const latitude = normalizeNullableNumber(payload.latitude);
  const longitude = normalizeNullableNumber(payload.longitude);
  const accuracyMeters = normalizeNullableNumber(
    payload.accuracyMeters ?? payload.accuracy,
  );
  const errors = [
    mode
      ? null
      : "Attendance mode must be office, remote, or field-visit.",
    validateCoordinate(latitude, -90, 90, "Latitude"),
    validateCoordinate(longitude, -180, 180, "Longitude"),
    accuracyMeters === null || accuracyMeters > 0
      ? null
      : "Accuracy must be a positive number when provided.",
  ].filter((error): error is string => error !== null);

  if (!mode || errors.length > 0) {
    return fail(...errors);
  }

  return success({
    mode,
    officeLocationId: normalizeNullableString(payload.officeLocationId),
    siteLocationId: normalizeNullableString(payload.siteLocationId),
    latitude,
    longitude,
    accuracyMeters,
    notes: normalizeNullableString(payload.notes),
    deviceId: normalizeNullableString(payload.deviceId),
  });
}

export function validateAttendanceQrSessionCreatePayload(
  input: unknown,
): ValidationResult<CreateAttendanceQrSessionRequest> {
  if (!input || typeof input !== "object") {
    return fail("QR session payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const action = normalizeText(payload.action);

  if (!isAttendanceQrAction(action)) {
    return fail("QR session action must be check_in or check_out.");
  }

  return success({
    action,
    officeLocationId: normalizeNullableString(payload.officeLocationId),
  });
}

export function validateAttendanceQrSessionVerifyPayload(
  input: unknown,
): ValidationResult<VerifyAttendanceQrSessionRequest> {
  if (!input || typeof input !== "object") {
    return fail("QR verification payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const token = normalizeText(payload.token);
  const latitude = normalizeNullableNumber(payload.latitude);
  const longitude = normalizeNullableNumber(payload.longitude);
  const accuracy = normalizeNullableNumber(payload.accuracy);
  const errors = [
    token.length > 0 ? null : "Verification token is required.",
    validateCoordinate(latitude, -90, 90, "Latitude"),
    validateCoordinate(longitude, -180, 180, "Longitude"),
    accuracy !== null && accuracy > 0
      ? null
      : "Accuracy must be a positive number.",
  ].filter((error): error is string => error !== null);

  if (errors.length > 0 || latitude === null || longitude === null || accuracy === null) {
    return fail(...errors);
  }

  return success({
    token,
    latitude,
    longitude,
    accuracy,
  });
}
