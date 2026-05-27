import type { ValidationResult } from "../auth/auth.types.js";
import {
  isHolidayType,
  type CreateHolidayRequest,
  type UpdateHolidayRequest,
} from "./admin-holiday-calendar.types.js";

function fail<T>(...errors: string[]): ValidationResult<T> {
  return { success: false, errors };
}

function success<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() || null : "";
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateCreateHolidayPayload(
  input: unknown,
): ValidationResult<CreateHolidayRequest> {
  if (!input || typeof input !== "object") {
    return fail("Holiday payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const name = text(payload.name);
  const date = text(payload.date);
  const type = text(payload.type);
  const description = optionalText(payload.description);
  const officeLocationId = optionalText(payload.officeLocationId);
  const errors: string[] = [];

  if (!name) errors.push("Holiday name is required.");
  if (!isDateOnly(date)) errors.push("Holiday date must be YYYY-MM-DD.");
  if (!isHolidayType(type)) errors.push("Holiday type is invalid.");
  if (description === "") errors.push("Holiday description is invalid.");
  if (officeLocationId === "") errors.push("Holiday office is invalid.");

  if (errors.length) return fail(...errors);

  return success({
    name,
    date,
    type: type as CreateHolidayRequest["type"],
    description,
    officeLocationId,
  });
}

export function validateUpdateHolidayPayload(
  input: unknown,
): ValidationResult<UpdateHolidayRequest> {
  if (!input || typeof input !== "object") {
    return fail("Holiday payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const name = payload.name === undefined ? undefined : text(payload.name);
  const date = payload.date === undefined ? undefined : text(payload.date);
  const type = payload.type === undefined ? undefined : text(payload.type);
  const description = optionalText(payload.description);
  const officeLocationId = optionalText(payload.officeLocationId);
  const isActive =
    typeof payload.isActive === "boolean" ? payload.isActive : undefined;
  const errors: string[] = [];

  if (name !== undefined && !name) errors.push("Holiday name is required.");
  if (date !== undefined && !isDateOnly(date)) {
    errors.push("Holiday date must be YYYY-MM-DD.");
  }
  if (type !== undefined && !isHolidayType(type)) {
    errors.push("Holiday type is invalid.");
  }
  if (description === "") errors.push("Holiday description is invalid.");
  if (officeLocationId === "") errors.push("Holiday office is invalid.");

  if (errors.length) return fail(...errors);

  return success({
    ...(name !== undefined ? { name } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(type !== undefined ? { type: type as UpdateHolidayRequest["type"] } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(officeLocationId !== undefined ? { officeLocationId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });
}
