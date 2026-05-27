import type { ValidationResult } from "../auth/auth.types.js";
import {
  isPermissionKey,
  type PermissionKey,
} from "../permissions/permissions.types.js";
import { normalizeRoleCode } from "../roles/roles.types.js";

export type CreateRoleRequest = {
  code: string;
  name: string;
  description: string;
};

export type UpdateRoleRequest = {
  name: string;
  description: string;
};

export type UpdateRolePermissionsRequest = {
  permissionKeys: PermissionKey[];
};

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

function normalizeDescription(value: unknown) {
  return normalizeString(value);
}

function validateCreateRoleLikePayload(
  input: unknown,
): ValidationResult<CreateRoleRequest> {
  if (!input || typeof input !== "object") {
    return fail("Role payload is required.");
  }

  const code = normalizeRoleCode(
    normalizeString((input as Record<string, unknown>).code),
  );
  const name = normalizeString((input as Record<string, unknown>).name);
  const description = normalizeDescription(
    (input as Record<string, unknown>).description,
  );

  if (!code || code.length < 2) {
    return fail("Role code must be at least 2 characters long.");
  }

  if (!/^[a-z][a-z0-9-]*$/.test(code)) {
    return fail("Role code must use lowercase letters, numbers, and hyphens only.");
  }

  if (!name || name.length < 2) {
    return fail("Role name must be at least 2 characters long.");
  }

  return success({
    code,
    name,
    description,
  });
}

function validateRoleLikePayload(
  input: unknown,
): ValidationResult<UpdateRoleRequest> {
  if (!input || typeof input !== "object") {
    return fail("Role payload is required.");
  }

  const name = normalizeString((input as Record<string, unknown>).name);
  const description = normalizeDescription(
    (input as Record<string, unknown>).description,
  );

  if (!name || name.length < 2) {
    return fail("Role name must be at least 2 characters long.");
  }

  return success({
    name,
    description,
  });
}

export function validateCreateRolePayload(
  input: unknown,
): ValidationResult<CreateRoleRequest> {
  return validateCreateRoleLikePayload(input);
}

export function validateUpdateRolePayload(
  input: unknown,
): ValidationResult<UpdateRoleRequest> {
  return validateRoleLikePayload(input);
}

export function validateUpdateRolePermissionsPayload(
  input: unknown,
): ValidationResult<UpdateRolePermissionsRequest> {
  if (!input || typeof input !== "object") {
    return fail("Permission payload is required.");
  }

  const permissionKeys = Array.isArray(
    (input as Record<string, unknown>).permissionKeys,
  )
    ? ((input as Record<string, unknown>).permissionKeys as unknown[])
    : [];

  const normalizedPermissionKeys = permissionKeys
    .map((permissionKey) => normalizeString(permissionKey))
    .filter((permissionKey): permissionKey is PermissionKey =>
      isPermissionKey(permissionKey),
    );

  if (permissionKeys.length > 0 && normalizedPermissionKeys.length === 0) {
    return fail("At least one valid permission key is required.");
  }

  return success({
    permissionKeys: [...new Set(normalizedPermissionKeys)],
  });
}
