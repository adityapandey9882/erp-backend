import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { policiesRepository } from "./policies.repository.js";
import type {
  AttendanceRoundingMode,
  CompanyPolicyField,
  CompanyPolicySettings,
  CompanyPolicyType,
  CompanyPolicyValue,
  LeaveResetCycle,
  PoliciesMutationResponse,
  PoliciesServiceResult,
  PoliciesWorkspaceResponse,
  UpdatePoliciesRequest,
} from "./policies.types.js";

function ok<T>(data: T): PoliciesServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): PoliciesServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

async function buildWorkspace(
  companyId: string,
): Promise<PoliciesWorkspaceResponse | null> {
  const [company, policyState] = await Promise.all([
    companiesService.getCompanyView(companyId),
    policiesRepository.listCompanyPolicies(companyId),
  ]);

  if (!company) {
    return null;
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: {
      totalPolicies: policyState.sections.reduce(
        (count, section) => count + section.policies.length,
        0,
      ),
      leavePolicies:
        policyState.sections.find((section) => section.type === "leave")
          ?.policies.length ?? 0,
      attendancePolicies:
        policyState.sections.find((section) => section.type === "attendance")
          ?.policies.length ?? 0,
      lastUpdatedAt: policyState.updatedAt,
    },
    sections: policyState.sections,
  };
}

function findPolicyValue(
  fields: readonly CompanyPolicyField[],
  type: CompanyPolicyType,
  key: string,
): CompanyPolicyValue | null {
  return fields.find((field) => field.type === type && field.key === key)?.value ?? null;
}

function readNumberPolicy(
  fields: readonly CompanyPolicyField[],
  type: CompanyPolicyType,
  key: string,
  fallback: number,
) {
  const value = findPolicyValue(fields, type, key);

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBooleanPolicy(
  fields: readonly CompanyPolicyField[],
  type: CompanyPolicyType,
  key: string,
  fallback: boolean,
) {
  const value = findPolicyValue(fields, type, key);

  return typeof value === "boolean" ? value : fallback;
}

function readStringPolicy<T extends string>(
  fields: readonly CompanyPolicyField[],
  type: CompanyPolicyType,
  key: string,
  allowedValues: readonly T[],
  fallback: T,
) {
  const value = findPolicyValue(fields, type, key);

  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : fallback;
}

async function resolveCompanyPolicySettings(
  companyId: string,
): Promise<CompanyPolicySettings> {
  await policiesRepository.ensureCompanyPolicies(companyId);

  const policyState = await policiesRepository.listCompanyPolicies(companyId);
  const fields = policyState.sections.flatMap((section) => section.policies);
  const workHoursPerDay = readNumberPolicy(
    fields,
    "attendance",
    "work_hours_per_day",
    8,
  );

  return {
    attendance: {
      allowManualEntry: readBooleanPolicy(
        fields,
        "attendance",
        "allow_manual_entry",
        false,
      ),
      lateThresholdMinutes: readNumberPolicy(
        fields,
        "attendance",
        "late_threshold_minutes",
        15,
      ),
      workHoursPerDay,
      workHoursReferenceMinutes: Math.round(workHoursPerDay * 60),
      attendanceRoundingMode: readStringPolicy<AttendanceRoundingMode>(
        fields,
        "attendance",
        "attendance_rounding_mode",
        ["exact", "nearest-15-minutes", "nearest-30-minutes"],
        "exact",
      ),
    },
    leave: {
      maxDaysPerYear: readNumberPolicy(
        fields,
        "leave",
        "max_days_per_year",
        24,
      ),
      allowHalfDay: readBooleanPolicy(fields, "leave", "allow_half_day", true),
      requireApproval: readBooleanPolicy(fields, "leave", "require_approval", true),
      leaveResetCycle: readStringPolicy<LeaveResetCycle>(
        fields,
        "leave",
        "leave_reset_cycle",
        ["calendar-year", "rolling-12-months"],
        "calendar-year",
      ),
    },
  };
}

export const policiesService = {
  getCompanyPolicySettings(companyId: string) {
    return resolveCompanyPolicySettings(companyId);
  },

  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<PoliciesServiceResult<PoliciesWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    await policiesRepository.ensureCompanyPolicies(user.companyId);

    const workspace = await buildWorkspace(user.companyId);

    if (!workspace) {
      return fail(404, "Company not found.");
    }

    return ok(workspace);
  },

  async updatePolicies(
    user: AuthenticatedUser,
    input: UpdatePoliciesRequest,
  ): Promise<PoliciesServiceResult<PoliciesMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    await policiesRepository.ensureCompanyPolicies(user.companyId);

    await policiesRepository.upsertCompanyPolicies(
      user.companyId,
      input.policies,
    );

    const workspace = await buildWorkspace(user.companyId);

    if (!workspace) {
      return fail(404, "Company not found.");
    }

    void auditService.recordAction(user, {
      action: "policy.updated",
      entityType: "company_policy",
      entityId: user.companyId,
      metadata: {
        policies: input.policies,
      },
    });

    return ok({
      message: "Company policies updated successfully.",
      workspace,
    });
  },
};
