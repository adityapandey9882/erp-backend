import type { ValidationResult } from "../auth/auth.types.js";
import {
  getCompanyPolicyDefinition,
  isCompanyPolicyType,
  type CompanyPolicyType,
  type UpdatePoliciesRequest,
  type UpdatePolicyItem,
} from "./policies.types.js";

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

function normalizePolicyInput(item: unknown): UpdatePolicyItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const type = normalizeString((item as Record<string, unknown>).type);
  const key = normalizeString((item as Record<string, unknown>).key);

  if (!isCompanyPolicyType(type)) {
    return null;
  }

  const definition = getCompanyPolicyDefinition(type, key);

  if (!definition) {
    return null;
  }

  const rawValue = (item as Record<string, unknown>).value;

  if (definition.inputType === "number") {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }

    if (definition.min !== undefined && rawValue < definition.min) {
      return null;
    }

    if (definition.max !== undefined && rawValue > definition.max) {
      return null;
    }
  } else if (definition.inputType === "toggle") {
    if (typeof rawValue !== "boolean") {
      return null;
    }
  } else if (definition.inputType === "select") {
    if (typeof rawValue !== "string") {
      return null;
    }

    if (
      definition.options?.length &&
      !definition.options.some((option) => option.value === rawValue)
    ) {
      return null;
    }
  }

  return {
    type: type as CompanyPolicyType,
    key,
    value: rawValue as UpdatePolicyItem["value"],
  };
}

export function validateUpdatePoliciesPayload(
  input: unknown,
): ValidationResult<UpdatePoliciesRequest> {
  if (!input || typeof input !== "object") {
    return fail("Policy payload is required.");
  }

  const policies = Array.isArray((input as Record<string, unknown>).policies)
    ? ((input as Record<string, unknown>).policies as unknown[])
    : [];

  if (policies.length === 0) {
    return fail("At least one policy update is required.");
  }

  const normalizedPolicies = policies.map(normalizePolicyInput);

  if (normalizedPolicies.some((policy) => policy === null)) {
    return fail("Each policy must use a valid configured key and value.");
  }

  const uniqueKeys = new Set<string>();

  for (const policy of normalizedPolicies as UpdatePolicyItem[]) {
    const uniqueKey = `${policy.type}:${policy.key}`;

    if (uniqueKeys.has(uniqueKey)) {
      return fail("Policy entries cannot repeat the same key.");
    }

    uniqueKeys.add(uniqueKey);
  }

  return success({
    policies: normalizedPolicies as UpdatePolicyItem[],
  });
}
