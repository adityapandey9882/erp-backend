import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { withTransaction } from "../../database/index.js";
import { companiesService } from "../companies/companies.service.js";
import {
  approvalsRepository,
  approvalsService,
  canUserActOnApprovalStep,
  resolveCurrentApprovalStep,
} from "../approvals/approvals.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { policiesService } from "../policies/policies.service.js";
import { usersRepository } from "../users/users.repository.js";
import { leaveRepository } from "./leave.repository.js";
import type {
  CreateEmployeeLeaveRequest,
  EmployeeLeaveMutationResponse,
  EmployeeLeaveWorkspaceResponse,
  HrLeaveEntry,
  HrLeaveMutationResponse,
  HrLeaveWorkspaceResponse,
  LeaveEmployeeSummary,
  LeavePolicyContext,
  LeavePolicyUsage,
  LeaveRequest,
  LeaveServiceResult,
  UpdateHrLeaveStatusRequest,
} from "./leave.types.js";
import type { AppRole } from "../roles/roles.types.js";
import type { LeavePolicySettings } from "../policies/policies.types.js";

function ok<T>(data: T): LeaveServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): LeaveServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function toEmployeeSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): LeaveEmployeeSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    employeeId: profile.employeeId,
    role: profile.role,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
    workLocation: profile.workLocation,
    profilePhotoUrl: profile.profilePhotoUrl,
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function buildHrSummary(items: readonly HrLeaveEntry[]) {
  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => isAwaitingHrReview(item)).length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
    employeesWithRequests: new Set(items.map((item) => item.employee.id)).size,
  };
}

function buildEmployeeSummary(items: readonly LeaveRequest[]) {
  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => item.status === "pending").length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
  };
}

const MS_PER_DAY = 86400000;

type PolicyDateWindow = {
  startDate: string;
  endDate: string;
};

function parseDateOnlyMs(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function formatDateOnlyMs(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(dateMs: number, days: number) {
  return dateMs + days * MS_PER_DAY;
}

function countInclusiveDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.floor((parseDateOnlyMs(endDate) - parseDateOnlyMs(startDate)) / MS_PER_DAY) +
      1,
  );
}

function calculateOverlapDays(
  itemStartDate: string,
  itemEndDate: string,
  window: PolicyDateWindow,
) {
  const startMs = Math.max(
    parseDateOnlyMs(itemStartDate),
    parseDateOnlyMs(window.startDate),
  );
  const endMs = Math.min(
    parseDateOnlyMs(itemEndDate),
    parseDateOnlyMs(window.endDate),
  );

  if (endMs < startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
}

function resolveCalendarYearWindow(referenceDate: string): PolicyDateWindow {
  const [year = 0] = referenceDate.split("-").map(Number);

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function resolveRollingWindow(referenceDate: string): PolicyDateWindow {
  const endMs = parseDateOnlyMs(referenceDate);

  return {
    startDate: formatDateOnlyMs(addDays(endMs, -364)),
    endDate: referenceDate,
  };
}

function resolveUsageWindow(
  policy: LeavePolicySettings,
  referenceDate: string,
): PolicyDateWindow {
  return policy.leaveResetCycle === "rolling-12-months"
    ? resolveRollingWindow(referenceDate)
    : resolveCalendarYearWindow(referenceDate);
}

function resolveRequestWindows(
  policy: LeavePolicySettings,
  input: CreateEmployeeLeaveRequest,
): PolicyDateWindow[] {
  if (policy.leaveResetCycle === "rolling-12-months") {
    return [
      {
        startDate: formatDateOnlyMs(addDays(parseDateOnlyMs(input.startDate), -364)),
        endDate: input.endDate,
      },
    ];
  }

  const startYear = Number(input.startDate.slice(0, 4));
  const endYear = Number(input.endDate.slice(0, 4));
  const windows: PolicyDateWindow[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    windows.push({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  }

  return windows;
}

function isCountedLeaveRequest(request: LeaveRequest) {
  return request.status === "pending" || request.status === "approved";
}

function calculateUsedLeaveDays(
  requests: readonly LeaveRequest[],
  window: PolicyDateWindow,
) {
  return requests
    .filter(isCountedLeaveRequest)
    .reduce(
      (total, request) =>
        total +
        calculateOverlapDays(request.startDate, request.endDate, window),
      0,
    );
}

function buildLeavePolicyUsage(
  policy: LeavePolicySettings,
  requests: readonly LeaveRequest[],
  referenceDate: string,
): LeavePolicyUsage {
  const window = resolveUsageWindow(policy, referenceDate);
  const usedDays = calculateUsedLeaveDays(requests, window);
  const maxDays = Math.max(0, policy.maxDaysPerYear);

  return {
    cycleStartDate: window.startDate,
    cycleEndDate: window.endDate,
    usedDays,
    remainingDays: Math.max(0, maxDays - usedDays),
  };
}

function buildLeavePolicyContext(
  policy: LeavePolicySettings,
  employeeUsage: LeavePolicyUsage | null,
): LeavePolicyContext {
  return {
    maxDaysPerYear: Math.max(0, policy.maxDaysPerYear),
    allowHalfDay: policy.allowHalfDay,
    halfDaySupported: false,
    requireApproval: policy.requireApproval,
    approvalRequiredByWorkflow: true,
    leaveResetCycle: policy.leaveResetCycle,
    employeeUsage,
    enforcementNotes: [
      `Maximum leave days are enforced against pending and approved requests in the ${policy.leaveResetCycle} cycle.`,
      policy.requireApproval
        ? "Leave requests must follow the approval matrix."
        : "Policy marks approval optional, but this workflow still uses the approval matrix because direct finalization is not safely supported yet.",
      policy.allowHalfDay
        ? "Half-day leave is configured as allowed, but the current leave table cannot represent half-day requests yet."
        : "Half-day leave is disabled; the current leave workflow records full-day date ranges only.",
    ],
  };
}

function validateLeaveLimit(
  policy: LeavePolicySettings,
  existingRequests: readonly LeaveRequest[],
  input: CreateEmployeeLeaveRequest,
) {
  const maxDays = Math.max(0, policy.maxDaysPerYear);
  const windows = resolveRequestWindows(policy, input);

  for (const window of windows) {
    const existingDays = calculateUsedLeaveDays(existingRequests, window);
    const requestedDays =
      policy.leaveResetCycle === "rolling-12-months"
        ? countInclusiveDays(input.startDate, input.endDate)
        : calculateOverlapDays(input.startDate, input.endDate, window);

    if (requestedDays > 0 && existingDays + requestedDays > maxDays) {
      return {
        ok: false as const,
        message: `This leave request exceeds the company policy limit of ${maxDays} day${maxDays === 1 ? "" : "s"} for ${window.startDate} to ${window.endDate}. ${existingDays} day${existingDays === 1 ? "" : "s"} are already pending or approved, and this request adds ${requestedDays} day${requestedDays === 1 ? "" : "s"}.`,
      };
    }
  }

  return {
    ok: true as const,
  };
}

async function buildHrLeaveEntry(
  companyId: string,
  request: LeaveRequest,
): Promise<HrLeaveEntry | null> {
  const profile = await usersRepository.findCompanyUserProfileById(
    companyId,
    request.userId,
  );
  const employee = toEmployeeSummary(profile);

  if (!employee) {
    return null;
  }

  return {
    ...request,
    employee,
  };
}

function isAwaitingHrReview(request: HrLeaveEntry) {
  const currentStep = resolveCurrentApprovalStep(request.approvalProgress ?? null);

  if (currentStep) {
    return request.status === "pending" && currentStep.role === "hr";
  }

  return (
    request.status === "pending" &&
    ["approved", "forwarded"].includes(request.managerReview.status)
  );
}

function resolveApprovalNotificationRoles(stepRole: string): AppRole[] {
  if (stepRole === "manager") {
    return ["project-manager", "team-lead"];
  }

  if (
    stepRole === "admin" ||
    stepRole === "hr" ||
    stepRole === "accounts" ||
    stepRole === "project-manager" ||
    stepRole === "team-lead" ||
    stepRole === "employee"
  ) {
    return [stepRole];
  }

  return [];
}

export const leaveService = {
  async getHrWorkspace(
    user: AuthenticatedUser,
  ): Promise<LeaveServiceResult<HrLeaveWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, requests, employees, policySettings] = await Promise.all([
      ensureCompanyContext(user),
      leaveRepository.listCompanyLeaveRequests(user.companyId),
      usersRepository.listCompanyUserProfiles(user.companyId),
      policiesService.getCompanyPolicySettings(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const hrVisibleEmployees = employees.filter(
      (employee) => employee.role !== "admin",
    );
    const employeeLookup = new Map(
      hrVisibleEmployees.map((employee) => [employee.id, toEmployeeSummary(employee)]),
    );

    const items = requests
      .map((request) => {
        const employee = employeeLookup.get(request.userId) ?? null;

        if (!employee) {
          return null;
        }

        return {
          ...request,
          employee,
        } satisfies HrLeaveEntry;
      })
      .filter((entry): entry is HrLeaveEntry => entry !== null);
    const itemsWithProgress = await approvalsService.attachLeaveApprovalProgress(
      user.companyId,
      items,
    );

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: buildHrSummary(itemsWithProgress),
      policy: buildLeavePolicyContext(policySettings.leave, null),
      items: itemsWithProgress,
    });
  },

  async getEmployeeWorkspace(
    user: AuthenticatedUser,
  ): Promise<LeaveServiceResult<EmployeeLeaveWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, profile, items, policySettings] = await Promise.all([
      ensureCompanyContext(user),
      usersRepository.findCompanyUserProfileById(user.companyId, user.id),
      leaveRepository.listSelfLeaveRequests(user.companyId, user.id),
      policiesService.getCompanyPolicySettings(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const employee = toEmployeeSummary(profile);

    if (!employee) {
      return fail(404, "Employee self profile not found.");
    }

    const itemsWithProgress = await approvalsService.attachLeaveApprovalProgress(
      user.companyId,
      items,
    );
    const currentDate = new Date().toISOString().slice(0, 10);
    const employeeUsage = buildLeavePolicyUsage(
      policySettings.leave,
      itemsWithProgress,
      currentDate,
    );

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      profile: employee,
      summary: buildEmployeeSummary(itemsWithProgress),
      policy: buildLeavePolicyContext(policySettings.leave, employeeUsage),
      items: itemsWithProgress,
    });
  },

  async requestLeave(
    user: AuthenticatedUser,
    input: CreateEmployeeLeaveRequest,
  ): Promise<LeaveServiceResult<EmployeeLeaveMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;

    const profile = await usersRepository.findCompanyUserProfileById(
      companyId,
      user.id,
    );

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    const policySettings = await policiesService.getCompanyPolicySettings(companyId);
    const approvalFlow = await approvalsService.ensureLeaveFlow(companyId);

    if (!approvalFlow) {
      return fail(409, "Unable to resolve the active leave approval flow.");
    }

    const transactionResult = await withTransaction(async (client) => {
      const overlappingRequest =
        await leaveRepository.findOverlappingOpenLeaveRequest(
          companyId,
          user.id,
          input.startDate,
          input.endDate,
          client,
        );

      if (overlappingRequest) {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "An existing pending or approved leave request already overlaps these dates.",
        };
      }

      const existingRequests = await leaveRepository.listSelfLeaveRequests(
        companyId,
        user.id,
        client,
      );
      const policyValidation = validateLeaveLimit(
        policySettings.leave,
        existingRequests,
        input,
      );

      if (!policyValidation.ok) {
        return {
          ok: false as const,
          status: 409 as const,
          message: policyValidation.message,
        };
      }

      const request = await leaveRepository.createLeaveRequest(
        companyId,
        user.id,
        input,
        client,
      );

      if (!request) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Unable to create leave request.",
        };
      }

      const approvalRequestId = await approvalsRepository.createApprovalChainForEntity(
        client,
        "leave",
        request.id,
        approvalFlow,
        user.id,
      );

      if (!approvalRequestId) {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "Unable to resolve an approver for the active leave approval flow.",
        };
      }

      return {
        ok: true as const,
        request,
      };
    });

    if (!transactionResult.ok) {
      return fail(transactionResult.status, transactionResult.message);
    }

    const [requestWithProgress] =
      await approvalsService.attachLeaveApprovalProgress(companyId, [
        transactionResult.request,
      ]);

    const currentStep = resolveCurrentApprovalStep(
      requestWithProgress.approvalProgress ?? null,
    );

    if (currentStep) {
      const roles = resolveApprovalNotificationRoles(currentStep.role);

      await Promise.all(
        roles.map((role) =>
          notificationsService.notifyRole(companyId, role, {
            type: "leave.request.created",
            title: "New leave request awaiting approval",
            message:
              currentStep.role === "manager"
                ? `${profile.fullName} submitted a ${requestWithProgress.leaveType} leave request for ${requestWithProgress.startDate} to ${requestWithProgress.endDate}. It is waiting for manager review.`
                : `${profile.fullName} submitted a ${requestWithProgress.leaveType} leave request for ${requestWithProgress.startDate} to ${requestWithProgress.endDate}. It is waiting for ${currentStep.roleLabel.toLowerCase()} review.`,
            entityType: "leave_request",
            entityId: requestWithProgress.id,
          }),
        ),
      );
    }

    return ok({
      message: "Leave request submitted successfully.",
      request: requestWithProgress,
    });
  },

  async reviewLeave(
    user: AuthenticatedUser,
    leaveId: string,
    input: UpdateHrLeaveStatusRequest,
  ): Promise<LeaveServiceResult<HrLeaveMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;

    const existingRequest = await leaveRepository.findCompanyLeaveRequestById(
      companyId,
      leaveId,
    );

    if (!existingRequest) {
      return fail(404, "Leave request not found.");
    }

    const approvalProgress = await approvalsService.getLeaveApprovalProgress(
      companyId,
      leaveId,
    );

    if (approvalProgress) {
      const currentStep = resolveCurrentApprovalStep(approvalProgress);

      if (!currentStep || !canUserActOnApprovalStep(user.role, currentStep.role)) {
        return fail(
          409,
          "This leave request is not currently awaiting HR review.",
        );
      }
    } else if (
      existingRequest.status !== "pending" ||
      !["approved", "forwarded"].includes(existingRequest.managerReview.status)
    ) {
      return fail(
        409,
        "Only leave requests that have passed manager review can be processed here.",
      );
    }

    const transactionResult = await withTransaction(async (client) => {
      const currentRequest = await leaveRepository.findCompanyLeaveRequestById(
        companyId,
        leaveId,
        client,
      );

      if (!currentRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Leave request not found.",
        };
      }

      if (currentRequest.status !== "pending") {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "Only pending leave requests can be approved or rejected in this milestone.",
        };
      }

      const decision = approvalProgress
        ? await approvalsRepository.recordApprovalDecision(client, {
            companyId,
            entityType: "leave",
            entityId: leaveId,
            stepId: resolveCurrentApprovalStep(approvalProgress)?.id ?? "",
            approverId: user.id,
            status: input.status,
            remarks: input.remarks ?? null,
          })
        : null;

      if (approvalProgress && !decision) {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "This approval step could not be updated because it is no longer pending.",
        };
      }

      const updatedRequest = await leaveRepository.updateLeaveStatus(
        companyId,
        leaveId,
        input.status,
        client,
      );

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Leave request not found.",
        };
      }

      return {
        ok: true as const,
        request: updatedRequest,
      };
    });

    if (!transactionResult.ok) {
      return fail(transactionResult.status, transactionResult.message);
    }

    const entry = await buildHrLeaveEntry(companyId, transactionResult.request);

    if (!entry) {
      return fail(404, "Employee profile for this leave request was not found.");
    }

    const [entryWithProgress] = await approvalsService.attachLeaveApprovalProgress(
      companyId,
      [entry],
    );

    void notificationsService.notifyUser(companyId, existingRequest.userId, {
      type: "leave.status.changed",
      title:
        input.status === "approved"
          ? "Leave request approved"
          : "Leave request rejected",
      message:
        input.status === "approved"
          ? `Your ${entryWithProgress.leaveType} leave request for ${entryWithProgress.startDate} to ${entryWithProgress.endDate} was approved by HR.`
          : `Your ${entryWithProgress.leaveType} leave request for ${entryWithProgress.startDate} to ${entryWithProgress.endDate} was rejected by HR.`,
      entityType: "leave_request",
      entityId: leaveId,
    });

    void auditService.recordAction(user, {
      action:
        input.status === "approved" ? "leave.approved" : "leave.rejected",
      entityType: "leave_request",
      entityId: leaveId,
      metadata: {
        reviewLayer: "hr",
        decision: input.status,
        requesterId: existingRequest.userId,
        leaveType: entryWithProgress.leaveType,
        leavePeriod: {
          startDate: entryWithProgress.startDate,
          endDate: entryWithProgress.endDate,
        },
      },
    });

    return ok({
      message:
        input.status === "approved"
          ? "Leave request approved successfully."
          : "Leave request rejected successfully.",
      request: entryWithProgress,
    });
  },
};
