import type { ValidationResult } from "../auth/auth.types.js";
import type {
  AssignShiftRequest,
  CreateShiftRequest,
  UpdateShiftRequest,
} from "./shifts.types.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

function normalizeTime(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const [hours = "", minutes = ""] = text.split(":");

  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : undefined;
}

function validateTime(value: string, label: string) {
  if (!value) {
    return `${label} is required.`;
  }

  if (!timePattern.test(value)) {
    return `${label} must use HH:MM 24-hour time.`;
  }

  return null;
}

function validateDate(value: string | undefined, label: string) {
  if (value === undefined) {
    return null;
  }

  if (!datePattern.test(value)) {
    return `${label} must use YYYY-MM-DD format.`;
  }

  return null;
}

function validateShiftShape(input: {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number | null;
  breakMinutes: number | null;
  isActive: boolean;
}) {
  const errors = [
    input.name ? null : "Shift name is required.",
    validateTime(input.startTime, "Start time"),
    validateTime(input.endTime, "End time"),
  ].filter((error): error is string => error !== null);

  if (input.startTime && input.endTime && input.startTime === input.endTime) {
    errors.push("Start time and end time cannot be the same.");
  }

  if (
    input.graceMinutes === null ||
    input.graceMinutes < 0 ||
    input.graceMinutes > 240
  ) {
    errors.push("Grace minutes must be between 0 and 240.");
  }

  if (
    input.breakMinutes === null ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 480
  ) {
    errors.push("Break minutes must be between 0 and 480.");
  }

  return errors;
}

export function validateCreateShiftPayload(
  input: unknown,
): ValidationResult<CreateShiftRequest> {
  if (!input || typeof input !== "object") {
    return fail("Shift payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const normalized = {
    name: normalizeText(payload.name),
    startTime: normalizeTime(payload.startTime),
    endTime: normalizeTime(payload.endTime),
    graceMinutes: normalizeNumber(payload.graceMinutes),
    breakMinutes: normalizeNumber(payload.breakMinutes),
    isActive: normalizeBoolean(payload.isActive, true),
  };
  const errors = validateShiftShape(normalized);

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name: normalized.name,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    graceMinutes: normalized.graceMinutes as number,
    breakMinutes: normalized.breakMinutes as number,
    isActive: normalized.isActive,
  });
}

export function validateUpdateShiftPayload(
  input: unknown,
): ValidationResult<UpdateShiftRequest> {
  if (!input || typeof input !== "object") {
    return fail("Shift update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const nextName = payload.name === undefined ? undefined : normalizeText(payload.name);
  const nextStartTime =
    payload.startTime === undefined ? undefined : normalizeTime(payload.startTime);
  const nextEndTime =
    payload.endTime === undefined ? undefined : normalizeTime(payload.endTime);
  const nextGraceMinutes =
    payload.graceMinutes === undefined ? undefined : normalizeNumber(payload.graceMinutes);
  const nextBreakMinutes =
    payload.breakMinutes === undefined ? undefined : normalizeNumber(payload.breakMinutes);
  const nextIsActive =
    payload.isActive === undefined ? undefined : normalizeBoolean(payload.isActive);
  const errors: string[] = [];

  if (nextName !== undefined && !nextName) {
    errors.push("Shift name cannot be empty.");
  }

  if (nextStartTime !== undefined) {
    const error = validateTime(nextStartTime, "Start time");

    if (error) {
      errors.push(error);
    }
  }

  if (nextEndTime !== undefined) {
    const error = validateTime(nextEndTime, "End time");

    if (error) {
      errors.push(error);
    }
  }

  if (nextGraceMinutes !== undefined) {
    if (nextGraceMinutes === null || nextGraceMinutes < 0 || nextGraceMinutes > 240) {
      errors.push("Grace minutes must be between 0 and 240.");
    }
  }

  if (nextBreakMinutes !== undefined) {
    if (nextBreakMinutes === null || nextBreakMinutes < 0 || nextBreakMinutes > 480) {
      errors.push("Break minutes must be between 0 and 480.");
    }
  }

  if (
    nextStartTime !== undefined &&
    nextEndTime !== undefined &&
    nextStartTime === nextEndTime
  ) {
    errors.push("Start time and end time cannot be the same.");
  }

  if (
    nextName === undefined &&
    nextStartTime === undefined &&
    nextEndTime === undefined &&
    nextGraceMinutes === undefined &&
    nextBreakMinutes === undefined &&
    nextIsActive === undefined
  ) {
    errors.push("At least one shift field must be provided.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    ...(nextName !== undefined ? { name: nextName } : {}),
    ...(nextStartTime !== undefined ? { startTime: nextStartTime } : {}),
    ...(nextEndTime !== undefined ? { endTime: nextEndTime } : {}),
    ...(nextGraceMinutes !== undefined ? { graceMinutes: nextGraceMinutes as number } : {}),
    ...(nextBreakMinutes !== undefined ? { breakMinutes: nextBreakMinutes as number } : {}),
    ...(nextIsActive !== undefined ? { isActive: nextIsActive } : {}),
  });
}

export function validateAssignShiftPayload(
  input: unknown,
): ValidationResult<AssignShiftRequest> {
  if (!input || typeof input !== "object") {
    return fail("Shift assignment payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const userId = normalizeText(payload.userId);
  const shiftId = normalizeText(payload.shiftId);
  const effectiveFrom = normalizeDate(payload.effectiveFrom);
  const effectiveTo =
    payload.effectiveTo === null
      ? null
      : payload.effectiveTo === undefined
        ? undefined
        : normalizeText(payload.effectiveTo);
  const errors = [
    userId ? null : "Employee identifier is required.",
    shiftId ? null : "Shift identifier is required.",
    validateDate(effectiveFrom, "Effective from"),
    effectiveTo === undefined || effectiveTo === null
      ? null
      : validateDate(effectiveTo, "Effective to"),
  ].filter((error): error is string => error !== null);

  if (
    effectiveFrom &&
    effectiveTo &&
    new Date(`${effectiveTo}T00:00:00.000Z`).getTime() <
      new Date(`${effectiveFrom}T00:00:00.000Z`).getTime()
  ) {
    errors.push("Effective to cannot be earlier than effective from.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    userId,
    shiftId,
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveTo !== undefined ? { effectiveTo } : {}),
  });
}
