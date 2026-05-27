import type { ValidationResult } from "../auth/auth.types.js";
import { isGlobalUserAccountStatus } from "./users.types.js";
import {
  isCompanyManagedUserRole,
  isUserAccountStatus,
  type CreateCompanyUserRequest,
  type SendCompanyUserNotificationRequest,
  type SetCompanyUserPasswordRequest,
  type UpdateGlobalUserRequest,
  type UpdateCompanyUserRequest,
  type UpdateCompanyUserStatusRequest,
} from "./users.types.js";

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

export function validateCreateCompanyUserPayload(
  input: unknown,
): ValidationResult<CreateCompanyUserRequest> {
  if (!input || typeof input !== "object") {
    return fail("User payload is required.");
  }

  const fullName = normalizeString((input as Record<string, unknown>).fullName);
  const email = normalizeString((input as Record<string, unknown>).email).toLowerCase();
  const password = normalizeString((input as Record<string, unknown>).password);
  const role = normalizeString((input as Record<string, unknown>).role);
  const status = normalizeString((input as Record<string, unknown>).status).toLowerCase();

  if (!fullName || fullName.length < 2) {
    return fail("Full name must be at least 2 characters long.");
  }

  if (!email || !isEmail(email)) {
    return fail("A valid email address is required.");
  }

  if (!password || password.length < 8) {
    return fail("Password must be at least 8 characters long.");
  }

  if (!isCompanyManagedUserRole(role)) {
    return fail("A valid company-managed role is required.");
  }

  if (!isUserAccountStatus(status)) {
    return fail("A valid user status is required.");
  }

  return success({
    fullName,
    email,
    password,
    role,
    status,
  });
}

export function validateUpdateCompanyUserStatusPayload(
  input: unknown,
): ValidationResult<UpdateCompanyUserStatusRequest> {
  if (!input || typeof input !== "object") {
    return fail("User status payload is required.");
  }

  const status = normalizeString((input as Record<string, unknown>).status).toLowerCase();

  if (!isUserAccountStatus(status)) {
    return fail("A valid user status is required.");
  }

  return success({ status });
}

export function validateSendCompanyUserNotificationPayload(
  input: unknown,
): ValidationResult<SendCompanyUserNotificationRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Notification payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const title = normalizeString(payload.title);
  const message = normalizeString(payload.message);
  const rawUserIds = Array.isArray(payload.userIds) ? payload.userIds : [];
  const userIds = Array.from(
    new Set(
      rawUserIds
        .filter((userId): userId is string => typeof userId === "string")
        .map((userId) => userId.trim())
        .filter(Boolean),
    ),
  );

  if (userIds.length === 0) {
    return fail("Select at least one employee to notify.");
  }

  if (!title || title.length < 3 || title.length > 120) {
    return fail("Notification title must be between 3 and 120 characters.");
  }

  if (!message || message.length < 5 || message.length > 500) {
    return fail("Notification message must be between 5 and 500 characters.");
  }

  return success({
    userIds,
    title,
    message,
  });
}

export function validateSetCompanyUserPasswordPayload(
  input: unknown,
): ValidationResult<SetCompanyUserPasswordRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Password payload is required.");
  }

  const newPassword = normalizeString(
    (input as Record<string, unknown>).newPassword,
  );
  const confirmPassword = normalizeString(
    (input as Record<string, unknown>).confirmPassword,
  );

  if (!newPassword || newPassword.length < 8) {
    return fail("New password must be at least 8 characters long.");
  }

  if (newPassword !== confirmPassword) {
    return fail("Password confirmation does not match.");
  }

  return success({
    newPassword,
    confirmPassword,
  });
}

function isPhoneFriendlyName(value: string) {
  return value.length >= 2;
}

export function validateUpdateCompanyUserPayload(
  input: unknown,
): ValidationResult<UpdateCompanyUserRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("User update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one editable user field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !["fullName", "email", "role", "status"].includes(key),
  );

  if (invalidKeys.length > 0) {
    return fail("Only fullName, email, role, and status can be updated here.");
  }

  const data: UpdateCompanyUserRequest = {};
  const errors: string[] = [];

  if ("fullName" in payload) {
    const fullName = normalizeString(payload.fullName);

    if (!fullName || !isPhoneFriendlyName(fullName)) {
      errors.push("Full name must be at least 2 characters long.");
    } else {
      data.fullName = fullName;
    }
  }

  if ("email" in payload) {
    const email = normalizeString(payload.email).toLowerCase();

    if (!email || !isEmail(email)) {
      errors.push("A valid email address is required.");
    } else {
      data.email = email;
    }
  }

  if ("role" in payload) {
    const role = normalizeString(payload.role);

    if (!isCompanyManagedUserRole(role)) {
      errors.push("A valid company-managed role is required.");
    } else {
      data.role = role;
    }
  }

  if ("status" in payload) {
    const status = normalizeString(payload.status).toLowerCase();

    if (!isUserAccountStatus(status)) {
      errors.push("A valid user status is required.");
    } else {
      data.status = status;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateUpdateGlobalUserPayload(
  input: unknown,
): ValidationResult<UpdateGlobalUserRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("User update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one editable user field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !["fullName", "email", "status"].includes(key),
  );

  if (invalidKeys.length > 0) {
    return fail("Only fullName, email, and status can be updated here.");
  }

  const data: UpdateGlobalUserRequest = {};
  const errors: string[] = [];

  if ("fullName" in payload) {
    const fullName = normalizeString(payload.fullName);

    if (!fullName || !isPhoneFriendlyName(fullName)) {
      errors.push("Full name must be at least 2 characters long.");
    } else {
      data.fullName = fullName;
    }
  }

  if ("email" in payload) {
    const email = normalizeString(payload.email).toLowerCase();

    if (!email || !isEmail(email)) {
      errors.push("A valid email address is required.");
    } else {
      data.email = email;
    }
  }

  if ("status" in payload) {
    const status = normalizeString(payload.status).toLowerCase();

    if (!isGlobalUserAccountStatus(status)) {
      errors.push("A valid global user status is required.");
    } else {
      data.status = status;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}
