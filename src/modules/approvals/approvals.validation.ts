import type { ValidationResult } from "../auth/auth.types.js";
import {
  isApprovalEntityType,
  isApprovalStepRole,
  type ApprovalEntityType,
  type ApprovalStepRole,
  type ApprovalDecisionPayload,
  type CreateApprovalRequestPayload,
} from "./approvals.types.js";

export type ApprovalFlowStepInput = {
  role: ApprovalStepRole;
  isRequired: boolean;
};

export type CreateApprovalFlowRequest = {
  entityType: ApprovalEntityType;
  name: string;
  steps: ApprovalFlowStepInput[];
};

export type UpdateApprovalFlowRequest = CreateApprovalFlowRequest;

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

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStepInput(step: unknown): ApprovalFlowStepInput | null {
  if (!step || typeof step !== "object") {
    return null;
  }

  const role = normalizeString((step as Record<string, unknown>).role);

  if (!isApprovalStepRole(role)) {
    return null;
  }

  return {
    role,
    isRequired: normalizeBoolean(
      (step as Record<string, unknown>).isRequired,
      true,
    ),
  };
}

function validateApprovalFlowPayload(
  input: unknown,
): ValidationResult<CreateApprovalFlowRequest> {
  if (!input || typeof input !== "object") {
    return fail("Approval flow payload is required.");
  }

  const entityType = normalizeString(
    (input as Record<string, unknown>).entityType,
  );
  const name = normalizeString((input as Record<string, unknown>).name);
  const rawSteps = Array.isArray((input as Record<string, unknown>).steps)
    ? ((input as Record<string, unknown>).steps as unknown[])
    : [];

  if (!isApprovalEntityType(entityType)) {
    return fail("A valid approval entity type is required.");
  }

  if (name.length < 2) {
    return fail("Approval flow name must be at least 2 characters long.");
  }

  if (rawSteps.length === 0) {
    return fail("At least one approval step is required.");
  }

  const steps = rawSteps.map(normalizeStepInput);

  if (steps.some((step) => step === null)) {
    return fail("Each approval step must use a valid approver role.");
  }

  const normalizedSteps = steps as ApprovalFlowStepInput[];
  const roleSet = new Set<ApprovalStepRole>();

  for (const step of normalizedSteps) {
    if (roleSet.has(step.role)) {
      return fail("Approval steps cannot reuse the same role more than once.");
    }

    roleSet.add(step.role);
  }

  return success({
    entityType,
    name,
    steps: normalizedSteps,
  });
}

export function validateCreateApprovalFlowPayload(
  input: unknown,
): ValidationResult<CreateApprovalFlowRequest> {
  return validateApprovalFlowPayload(input);
}

export function validateUpdateApprovalFlowPayload(
  input: unknown,
): ValidationResult<UpdateApprovalFlowRequest> {
  return validateApprovalFlowPayload(input);
}

function validateCreateApprovalRequestInput(
  input: unknown,
): ValidationResult<CreateApprovalRequestPayload> {
  if (!input || typeof input !== "object") {
    return fail("Approval request payload is required.");
  }

  const module = normalizeString((input as Record<string, unknown>).module);
  const entityId = normalizeString((input as Record<string, unknown>).entityId);

  if (!isApprovalEntityType(module)) {
    return fail("A valid approval module is required.");
  }

  if (!entityId) {
    return fail("An approval entity identifier is required.");
  }

  return success({
    module,
    entityId,
  });
}

export function validateCreateApprovalRequestPayload(
  input: unknown,
): ValidationResult<CreateApprovalRequestPayload> {
  return validateCreateApprovalRequestInput(input);
}

function validateApprovalDecisionInput(
  input: unknown,
): ValidationResult<ApprovalDecisionPayload> {
  if (!input || typeof input !== "object") {
    return fail("Approval decision payload is required.");
  }

  const remarks = normalizeOptionalString(
    (input as Record<string, unknown>).remarks,
  );

  if (remarks && remarks.length > 2000) {
    return fail("Approval remarks must not exceed 2000 characters.");
  }

  return success({
    remarks,
  });
}

export function validateApprovalDecisionPayload(
  input: unknown,
): ValidationResult<ApprovalDecisionPayload> {
  return validateApprovalDecisionInput(input);
}

