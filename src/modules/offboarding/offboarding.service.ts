import { withTransaction } from "../../database/index.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import {
  approvalsRepository,
  approvalsService,
  canUserActOnApprovalStep,
  resolveCurrentApprovalStep,
} from "../approvals/approvals.service.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import { designationsService } from "../designations/designations.service.js";
import { employeeSelfRepository } from "../employee-self/employee-self.repository.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { usersRepository } from "../users/users.repository.js";
import { offboardingRepository } from "./offboarding.repository.js";
import type {
  CreateOffboardingRequest,
  OffboardingChecklistItem,
  OffboardingChecklistSummary,
  OffboardingClearanceSummary,
  OffboardingEmployeeSummary,
  OffboardingExitType,
  OffboardingMutationResponse,
  OffboardingRequestRecord,
  OffboardingRequestStatus,
  OffboardingServiceResult,
  OffboardingWorkspaceResponse,
  ReviewOffboardingRequest,
  TriggerOffboardingRequestAction,
  UpdateOffboardingRequestDetails,
} from "./offboarding.types.js";

const DEFAULT_REQUESTED_EXIT_DOCUMENTS = 3;
const DEFAULT_ACCESS_CHECKPOINTS = 12;

class OffboardingWorkflowError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "OffboardingWorkflowError";
  }
}

function ok<T>(data: T): OffboardingServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): OffboardingServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function workflowFail(status: 400 | 403 | 404 | 409, message: string): never {
  throw new OffboardingWorkflowError(status, message);
}

function isWorkflowError(error: unknown): error is OffboardingWorkflowError {
  return error instanceof OffboardingWorkflowError;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function normalizeStatusFilter(
  value?: string | null,
): OffboardingRequestStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "completed"
  ) {
    return normalized;
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return undefined;
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSameMonth(value: string | null, reference: Date) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === reference.getUTCFullYear() &&
    date.getUTCMonth() === reference.getUTCMonth()
  );
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildExitInterviewSchedule(lastWorkingDate: string | null) {
  if (!lastWorkingDate || !isDateOnly(lastWorkingDate)) {
    return null;
  }

  return new Date(`${lastWorkingDate}T11:00:00.000Z`).toISOString();
}

function toEmployeeSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): OffboardingEmployeeSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email.toLowerCase(),
    phone: profile.phone,
    employeeId: profile.employeeId,
    role: profile.role,
    status: profile.status,
    reportingManager: profile.reportingManager,
    department: profile.department,
    designation: profile.designation,
  };
}

function checklistStatusMeta(value: {
  completed: boolean;
  inProgress?: boolean;
}): OffboardingChecklistItem["status"] {
  if (value.completed) {
    return "completed";
  }

  if (value.inProgress) {
    return "in-progress";
  }

  return "pending";
}

function hasApprovedStep(
  request: OffboardingRequestRecord,
  role: "manager" | "accounts" | "hr" | "admin",
) {
  return request.approvalProgress?.steps.some(
    (step) => step.role === role && step.status === "approved",
  ) ?? false;
}

function buildChecklist(request: OffboardingRequestRecord) {
  const today = new Date().toISOString().slice(0, 10);
  const lastWorkingDateLabel = request.lastWorkingDate?.slice(0, 10) ?? null;
  const noticeServed =
    lastWorkingDateLabel !== null && lastWorkingDateLabel <= today;
  const noticeInProgress =
    !noticeServed &&
    Boolean(request.resignationDate) &&
    (request.noticePeriodDays ?? 0) > 0;
  const managerApproved = hasApprovedStep(request, "manager");
  const assetsReturned = request.assignedAssetCount === 0;
  const documentsReady = request.documentCount >= request.requestedDocumentCount;
  const knowledgeTransferCompleted =
    request.status === "approved" || request.status === "completed";
  const knowledgeTransferInProgress =
    !knowledgeTransferCompleted &&
    ((request.approvalProgress?.completedSteps ?? 0) > 0 || request.documentCount > 0);
  const finalSettlementStatus =
    request.status === "completed"
      ? "completed"
      : request.status === "approved" && assetsReturned
        ? "ready"
        : "pending";

  const items: OffboardingChecklistItem[] = [
    {
      key: "resignation-received",
      label: "Resignation Received",
      status: checklistStatusMeta({
        completed: Boolean(request.resignationDate),
      }),
      helper: request.resignationDate
        ? `Submitted on ${request.resignationDate.slice(0, 10)}`
        : "Waiting for resignation details.",
    },
    {
      key: "manager-approved",
      label: "Manager Approved",
      status: checklistStatusMeta({
        completed: managerApproved,
        inProgress:
          request.approvalProgress?.steps.some(
            (step) => step.role === "manager" && step.isCurrent,
          ) ?? false,
      }),
      helper: managerApproved
        ? "Manager review cleared."
        : "Pending manager sign-off in the approval chain.",
    },
    {
      key: "notice-period-served",
      label: "Notice Period Served",
      status: checklistStatusMeta({
        completed: noticeServed,
        inProgress: noticeInProgress,
      }),
      helper: lastWorkingDateLabel
        ? `Last working date ${lastWorkingDateLabel}`
        : "Waiting for a last working date.",
    },
    {
      key: "knowledge-transfer",
      label: "Knowledge Transfer",
      status: checklistStatusMeta({
        completed: knowledgeTransferCompleted,
        inProgress: knowledgeTransferInProgress,
      }),
      helper:
        knowledgeTransferCompleted
          ? "Ownership handover is complete."
          : "Handover is still progressing through approvals and documents.",
    },
    {
      key: "asset-return",
      label: "Asset Return",
      status: checklistStatusMeta({
        completed: assetsReturned,
        inProgress: request.expectedAssetCount > request.assignedAssetCount,
      }),
      helper: assetsReturned
        ? "No assigned assets are blocking the exit."
        : `${request.assignedAssetCount} assigned asset(s) still need to be returned.`,
    },
    {
      key: "access-revocation",
      label: "Access Revocation",
      status: checklistStatusMeta({
        completed: request.status === "completed",
        inProgress:
          request.status === "approved" || (request.approvalProgress?.completedSteps ?? 0) > 0,
      }),
      helper:
        request.status === "completed"
          ? "Access has been fully revoked."
          : "System access revocation will finalize near exit completion.",
    },
    {
      key: "exit-documents",
      label: "Exit Documents",
      status: checklistStatusMeta({
        completed: documentsReady,
        inProgress: request.documentCount > 0,
      }),
      helper:
        documentsReady
          ? "Required exit documents are available."
          : `${request.requestedDocumentCount - Math.min(request.documentCount, request.requestedDocumentCount)} document step(s) are still pending.`,
    },
    {
      key: "exit-interview",
      label: "Exit Interview",
      status: checklistStatusMeta({
        completed: request.status === "completed",
        inProgress: Boolean(request.exitInterviewScheduledAt ?? request.lastWorkingDate),
      }),
      helper:
        request.exitInterviewScheduledAt ?? request.lastWorkingDate
          ? `Scheduled around ${(
              request.exitInterviewScheduledAt ?? request.lastWorkingDate
            )!.slice(0, 10)}`
          : "Exit interview is not scheduled yet.",
    },
    {
      key: "final-settlement",
      label: "Final Settlement",
      status: checklistStatusMeta({
        completed: finalSettlementStatus === "completed",
        inProgress: finalSettlementStatus === "ready",
      }),
      helper:
        finalSettlementStatus === "completed"
          ? "Final settlement is closed."
          : finalSettlementStatus === "ready"
            ? "Settlement is ready for release."
            : "Settlement will follow clearance and approvals.",
    },
    {
      key: "offboarding-completed",
      label: "Offboarding Completed",
      status: checklistStatusMeta({
        completed: request.status === "completed",
        inProgress: request.status === "approved" && assetsReturned,
      }),
      helper:
        request.status === "completed"
          ? "Employee account has been deactivated."
          : "Waiting for final completion by HR.",
    },
  ];

  const completedCount = items.filter((item) => item.status === "completed").length;
  const partialCount = items.filter((item) => item.status === "in-progress").length;
  const totalCount = items.length;
  const progressPercent = clampPercentage(
    ((completedCount + partialCount * 0.5) / totalCount) * 100,
  );

  const checklist: OffboardingChecklistSummary = {
    items,
    completedCount,
    totalCount,
    progressPercent,
  };

  const clearance: OffboardingClearanceSummary = {
    expectedAssetCount: request.expectedAssetCount,
    returnedAssetCount: Math.max(
      request.expectedAssetCount - request.assignedAssetCount,
      0,
    ),
    pendingAssetCount: request.assignedAssetCount,
    knowledgeTransferPercent: clampPercentage(
      ((completedCount + partialCount * 0.5) / Math.max(totalCount, 1)) * 100,
    ),
    pendingApprovals: Math.max(
      (request.approvalProgress?.totalSteps ?? 0) -
        (request.approvalProgress?.completedSteps ?? 0),
      0,
    ),
    revokedAccessCount: Math.min(
      DEFAULT_ACCESS_CHECKPOINTS,
      Math.round((progressPercent / 100) * DEFAULT_ACCESS_CHECKPOINTS),
    ),
    totalAccessCount: DEFAULT_ACCESS_CHECKPOINTS,
    exitInterviewScheduledAt:
      request.exitInterviewScheduledAt ?? buildExitInterviewSchedule(request.lastWorkingDate),
    exitInterviewCompleted: request.status === "completed",
    finalSettlementStatus:
      request.status === "completed"
        ? "completed"
        : request.status === "approved" && assetsReturned
          ? "ready"
          : "pending",
    finalSettlementAmount: request.finalSettlementAmount,
    documentsReadyCount: Math.min(
      request.documentCount,
      request.requestedDocumentCount,
    ),
    documentsPendingCount: Math.max(
      request.requestedDocumentCount - request.documentCount,
      0,
    ),
  };

  let workflowStage: OffboardingRequestRecord["workflowStage"] = "clearance-pending";

  if (request.status === "completed") {
    workflowStage = "completed";
  } else if (request.status === "rejected") {
    workflowStage = "rejected";
  } else if (!noticeServed) {
    workflowStage = "notice-period";
  } else if (
    clearance.pendingAssetCount > 0 ||
    !documentsReady ||
    request.status === "pending"
  ) {
    workflowStage = "clearance-pending";
  } else if (clearance.finalSettlementStatus !== "completed") {
    workflowStage = "settlement-pending";
  } else {
    workflowStage = "ready-to-exit";
  }

  return {
    checklist,
    clearance,
    workflowStage,
    progressPercent,
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

async function resolveEmployeeOrganizationAssignment(
  companyId: string,
  input: {
    departmentId: string;
    designationId: string;
  },
) {
  const [departments, designations] = await Promise.all([
    departmentsService.listCompanyDepartments(companyId),
    designationsService.listCompanyDesignations(companyId),
  ]);

  const department = departments.find((entry) => entry.id === input.departmentId);

  if (!department) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Department not found for this company.",
    };
  }

  const designation = designations.find(
    (entry) => entry.id === input.designationId,
  );

  if (!designation) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Designation not found for this company.",
    };
  }

  if (designation.department?.id && designation.department.id !== department.id) {
    return {
      ok: false as const,
      status: 409 as const,
      message:
        "The selected designation belongs to a different department for this company.",
    };
  }

  return {
    ok: true as const,
    data: {
      departmentId: department.id,
      designationId: designation.id,
    },
  };
}

async function resolveReportingManager(
  companyId: string,
  userId: string,
  reportingManagerId: string,
) {
  if (reportingManagerId === userId) {
    return {
      ok: false as const,
      status: 409 as const,
      message: "Reporting manager cannot match the employee account.",
    };
  }

  const manager = await employeeSelfRepository.findCompanyUserActorSummary(
    companyId,
    reportingManagerId,
  );

  if (!manager) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Reporting manager not found for this company.",
    };
  }

  return {
    ok: true as const,
    data: manager,
  };
}

async function resolveOffboardingDetailsInput(
  companyId: string,
  userId: string,
  input: {
    departmentId: string;
    designationId: string;
    reportingManagerId: string;
    exitType: OffboardingExitType;
    resignationDate: string;
    lastWorkingDate: string;
    noticePeriodDays: number;
    reason: string | null;
  },
) {
  if (!isDateOnly(input.resignationDate)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Resignation date must use the YYYY-MM-DD format.",
    };
  }

  if (!isDateOnly(input.lastWorkingDate)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Last working date must use the YYYY-MM-DD format.",
    };
  }

  if (input.lastWorkingDate < input.resignationDate) {
    return {
      ok: false as const,
      status: 409 as const,
      message: "Last working date cannot be earlier than the resignation date.",
    };
  }

  if (!Number.isInteger(input.noticePeriodDays) || input.noticePeriodDays < 0) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Notice period days must be a whole number greater than or equal to zero.",
    };
  }

  const [assignmentResult, managerResult] = await Promise.all([
    resolveEmployeeOrganizationAssignment(companyId, {
      departmentId: input.departmentId,
      designationId: input.designationId,
    }),
    resolveReportingManager(companyId, userId, input.reportingManagerId),
  ]);

  if (!assignmentResult.ok) {
    return assignmentResult;
  }

  if (!managerResult.ok) {
    return managerResult;
  }

  return {
    ok: true as const,
    data: {
      departmentId: assignmentResult.data.departmentId,
      designationId: assignmentResult.data.designationId,
      reportingManagerId: managerResult.data.id,
      exitType: input.exitType,
      resignationDate: input.resignationDate,
      lastWorkingDate: input.lastWorkingDate,
      noticePeriodDays: input.noticePeriodDays,
      reason: input.reason,
      exitInterviewScheduledAt: buildExitInterviewSchedule(input.lastWorkingDate),
    },
  };
}

async function enrichRequests(
  requests: readonly OffboardingRequestRecord[],
) {
  return requests.map((request) => {
    const derived = buildChecklist(request);

    return {
      ...request,
      checklist: derived.checklist,
      clearance: derived.clearance,
      workflowStage: derived.workflowStage,
      progressPercent: derived.progressPercent,
    };
  });
}

async function hydrateRequest(
  companyId: string,
  request: OffboardingRequestRecord,
) {
  const [requestWithProgress] = await approvalsService.attachEntityApprovalProgress(
    companyId,
    "offboarding",
    [request],
  );
  const [enhancedRequest] = await enrichRequests([requestWithProgress]);

  return enhancedRequest;
}

function buildSummary(items: readonly OffboardingRequestRecord[]) {
  const now = new Date();

  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => item.status === "pending").length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
    completedRequests: items.filter((item) => item.status === "completed").length,
    readyToCompleteRequests: items.filter(
      (item) => item.status === "approved" && item.assignedAssetCount === 0,
    ).length,
    assetsPendingReturn: items.reduce(
      (count, item) => count + item.assignedAssetCount,
      0,
    ),
    documentsTracked: items.reduce((count, item) => count + item.documentCount, 0),
    activeRequests: items.filter(
      (item) => item.status === "pending" || item.status === "approved",
    ).length,
    noticePeriodRequests: items.filter(
      (item) => item.workflowStage === "notice-period",
    ).length,
    clearancePendingRequests: items.filter(
      (item) => item.workflowStage === "clearance-pending",
    ).length,
    finalSettlementPendingRequests: items.filter(
      (item) => item.workflowStage === "settlement-pending",
    ).length,
    completedThisMonth: items.filter((item) =>
      isSameMonth(item.completedAt, now),
    ).length,
  };
}

async function buildWorkspace(
  user: AuthenticatedUser,
  filters: {
    userId?: string | null;
    status?: string | null;
  },
): Promise<OffboardingWorkspaceResponse | null> {
  if (!user.companyId) {
    return null;
  }

  const [company, rawRequests, profiles, departments, designations] =
    await Promise.all([
      ensureCompanyContext(user),
      offboardingRepository.listOffboardingRequests(user.companyId),
      usersRepository.listCompanyUserProfiles(user.companyId),
      departmentsService.listCompanyDepartments(user.companyId),
      designationsService.listCompanyDesignations(user.companyId),
    ]);

  if (!company) {
    return null;
  }

  const normalizedStatus = normalizeStatusFilter(filters.status);
  const normalizedUserId = filters.userId?.trim() || null;

  const filteredRequests = rawRequests.filter((request) => {
    if (normalizedUserId && request.userId !== normalizedUserId) {
      return false;
    }

    if (normalizedStatus && request.status !== normalizedStatus) {
      return false;
    }

    return true;
  });

  const requestsWithProgress = await approvalsService.attachEntityApprovalProgress(
    user.companyId,
    "offboarding",
    filteredRequests,
  );
  const enrichedRequests = await enrichRequests(requestsWithProgress);
  const enrichedAllRequests = await enrichRequests(
    await approvalsService.attachEntityApprovalProgress(
      user.companyId,
      "offboarding",
      rawRequests,
    ),
  );

  const activeRequestUserIds = new Set(
    rawRequests
      .filter((request) => request.status === "pending" || request.status === "approved")
      .map((request) => request.userId),
  );

  const availableUsers = profiles
    .filter((profile) => profile.role !== "admin")
    .filter((profile) => profile.status === "active")
    .filter((profile) => !activeRequestUserIds.has(profile.id))
    .map(toEmployeeSummary)
    .filter((profile): profile is OffboardingEmployeeSummary => profile !== null)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const managers = profiles
    .filter((profile) => profile.status === "active")
    .filter((profile) => profile.role !== "employee")
    .map((profile) => ({
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email.toLowerCase(),
      role: profile.role,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: buildSummary(enrichedAllRequests),
    organization: {
      departments,
      designations,
      managers,
    },
    activeFilters: {
      userId: normalizedUserId,
      status: normalizedStatus,
    },
    availableUsers,
    requests: enrichedRequests,
  };
}

export const offboardingService = {
  async getWorkspace(
    user: AuthenticatedUser,
    filters: {
      userId?: string | null;
      status?: string | null;
    } = {},
  ): Promise<OffboardingServiceResult<OffboardingWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const workspace = await buildWorkspace(user, filters);

    if (!workspace) {
      return fail(404, "Company not found.");
    }

    return ok(workspace);
  },

  async createRequest(
    user: AuthenticatedUser,
    input: CreateOffboardingRequest,
  ): Promise<OffboardingServiceResult<OffboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const targetEmployee = await usersRepository.findCompanyUserProfileById(
      companyId,
      input.userId,
    );

    if (!targetEmployee) {
      return fail(404, "Target employee not found.");
    }

    if (targetEmployee.role === "admin") {
      return fail(409, "Offboarding cannot be created for company admin accounts.");
    }

    if (targetEmployee.status !== "active") {
      return fail(
        409,
        "Offboarding can only be created for active company accounts.",
      );
    }

    const existingActiveRequest =
      await offboardingRepository.findActiveOffboardingRequestByUserId(
        companyId,
        input.userId,
      );

    if (existingActiveRequest) {
      return fail(
        409,
        "An active offboarding request already exists for this employee.",
      );
    }

    const resolvedDetails = await resolveOffboardingDetailsInput(
      companyId,
      input.userId,
      {
        departmentId: input.departmentId,
        designationId: input.designationId,
        reportingManagerId: input.reportingManagerId,
        exitType: input.exitType,
        resignationDate: input.resignationDate,
        lastWorkingDate: input.lastWorkingDate,
        noticePeriodDays: input.noticePeriodDays,
        reason: input.reason ?? null,
      },
    );

    if (!resolvedDetails.ok) {
      return fail(resolvedDetails.status, resolvedDetails.message);
    }

    const approvalFlow = await approvalsService.ensureOffboardingFlow(companyId);

    if (!approvalFlow) {
      return fail(
        409,
        "Unable to resolve the active offboarding approval flow.",
      );
    }

    let requestRecord: OffboardingRequestRecord | null = null;

    try {
      requestRecord = await withTransaction(async (client) => {
        const expectedAssetCount =
          await offboardingRepository.countAssignedAssetsByUser(
            companyId,
            targetEmployee.id,
            client,
          );

        const requestId = await offboardingRepository.createOffboardingRequest(
          {
            companyId,
            userId: targetEmployee.id,
            initiatedBy: user.id,
            assignedHrUserId: user.id,
            departmentId: resolvedDetails.data.departmentId,
            designationId: resolvedDetails.data.designationId,
            reportingManagerUserId: resolvedDetails.data.reportingManagerId,
            exitType: resolvedDetails.data.exitType,
            resignationDate: resolvedDetails.data.resignationDate,
            lastWorkingDate: resolvedDetails.data.lastWorkingDate,
            noticePeriodDays: resolvedDetails.data.noticePeriodDays,
            reason: resolvedDetails.data.reason,
            expectedAssetCount,
            requestedDocumentCount: DEFAULT_REQUESTED_EXIT_DOCUMENTS,
            exitInterviewScheduledAt: resolvedDetails.data.exitInterviewScheduledAt,
          },
          client,
        );

        if (!requestId) {
          workflowFail(409, "Unable to create the offboarding request.");
        }

        const approvalRequestId = await approvalsRepository.createApprovalChainForEntity(
          client,
          "offboarding",
          requestId,
          approvalFlow,
          user.id,
        );

        if (!approvalRequestId) {
          workflowFail(
            409,
            "Unable to resolve an approver for the active offboarding approval flow.",
          );
        }

        const createdRequest = await offboardingRepository.findOffboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!createdRequest) {
          workflowFail(404, "Offboarding request not found.");
        }

        return createdRequest;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "An active offboarding request already exists for this employee.",
        );
      }

      if (isWorkflowError(error)) {
        return fail(error.status, error.message);
      }

      throw error;
    }

    if (!requestRecord) {
      return fail(404, "Offboarding request not found.");
    }

    const requestWithProgress = await hydrateRequest(companyId, requestRecord);

    void auditService.recordAction(user, {
      action: "offboarding.request.created",
      entityType: "offboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        exitType: requestWithProgress.exitType,
        lastWorkingDate: requestWithProgress.lastWorkingDate,
        noticePeriodDays: requestWithProgress.noticePeriodDays,
        assignedAssetCount: requestWithProgress.assignedAssetCount,
      },
    });

    return ok({
      message: "Offboarding request created successfully.",
      request: requestWithProgress,
    });
  },

  async updateRequestDetails(
    user: AuthenticatedUser,
    requestId: string,
    input: UpdateOffboardingRequestDetails,
  ): Promise<OffboardingServiceResult<OffboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await offboardingRepository.findOffboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Offboarding request not found.");
    }

    if (existingRequest.status === "completed") {
      return fail(409, "Completed offboarding requests cannot be edited.");
    }

    if (existingRequest.status === "rejected") {
      return fail(409, "Rejected offboarding requests cannot be edited.");
    }

    const mergedDepartmentId =
      normalizeOptionalString(input.departmentId) ??
      existingRequest.department?.id ??
      existingRequest.employee.department?.id;
    const mergedDesignationId =
      normalizeOptionalString(input.designationId) ??
      existingRequest.designation?.id ??
      existingRequest.employee.designation?.id;
    const mergedReportingManagerId =
      normalizeOptionalString(input.reportingManagerId) ??
      existingRequest.reportingManager?.id ??
      existingRequest.employee.reportingManager?.id;
    const mergedExitType =
      (normalizeOptionalString(input.exitType) as OffboardingExitType | null | undefined) ??
      existingRequest.exitType;
    const mergedResignationDate =
      normalizeOptionalString(input.resignationDate) ??
      existingRequest.resignationDate?.slice(0, 10);
    const mergedLastWorkingDate =
      normalizeOptionalString(input.lastWorkingDate) ??
      existingRequest.lastWorkingDate?.slice(0, 10);
    const mergedNoticePeriodDays =
      normalizeOptionalNumber(input.noticePeriodDays) ??
      existingRequest.noticePeriodDays;
    const mergedReason =
      normalizeOptionalString(input.reason) === undefined
        ? existingRequest.reason
        : normalizeOptionalString(input.reason);

    if (
      !mergedDepartmentId ||
      !mergedDesignationId ||
      !mergedReportingManagerId ||
      !mergedExitType ||
      !mergedResignationDate ||
      !mergedLastWorkingDate ||
      typeof mergedNoticePeriodDays !== "number"
    ) {
      return fail(400, "Offboarding request details are incomplete.");
    }

    const resolvedDetails = await resolveOffboardingDetailsInput(
      companyId,
      existingRequest.userId,
      {
        departmentId: mergedDepartmentId,
        designationId: mergedDesignationId,
        reportingManagerId: mergedReportingManagerId,
        exitType: mergedExitType,
        resignationDate: mergedResignationDate,
        lastWorkingDate: mergedLastWorkingDate,
        noticePeriodDays: mergedNoticePeriodDays,
        reason: mergedReason ?? null,
      },
    );

    if (!resolvedDetails.ok) {
      return fail(resolvedDetails.status, resolvedDetails.message);
    }

    const updatedRequestId = await offboardingRepository.updateOffboardingRequestDetails(
      companyId,
      requestId,
      {
        departmentId: resolvedDetails.data.departmentId,
        designationId: resolvedDetails.data.designationId,
        reportingManagerUserId: resolvedDetails.data.reportingManagerId,
        exitType: resolvedDetails.data.exitType,
        resignationDate: resolvedDetails.data.resignationDate,
        lastWorkingDate: resolvedDetails.data.lastWorkingDate,
        noticePeriodDays: resolvedDetails.data.noticePeriodDays,
        reason: resolvedDetails.data.reason,
        exitInterviewScheduledAt: resolvedDetails.data.exitInterviewScheduledAt,
      },
    );

    if (!updatedRequestId) {
      return fail(404, "Offboarding request not found.");
    }

    const updatedRequest = await offboardingRepository.findOffboardingRequestById(
      companyId,
      requestId,
    );

    if (!updatedRequest) {
      return fail(404, "Offboarding request not found.");
    }

    const requestWithProgress = await hydrateRequest(companyId, updatedRequest);

    void auditService.recordAction(user, {
      action: "offboarding.details.updated",
      entityType: "offboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        exitType: requestWithProgress.exitType,
        lastWorkingDate: requestWithProgress.lastWorkingDate,
        noticePeriodDays: requestWithProgress.noticePeriodDays,
      },
    });

    return ok({
      message: "Offboarding details updated successfully.",
      request: requestWithProgress,
    });
  },

  async triggerRequestAction(
    user: AuthenticatedUser,
    requestId: string,
    input: TriggerOffboardingRequestAction,
  ): Promise<OffboardingServiceResult<OffboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await offboardingRepository.findOffboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Offboarding request not found.");
    }

    let type: "offboarding.reminder" | "offboarding.letters-generated";
    let title = "";
    let message = "";
    let responseMessage = "";

    if (input.action === "send-reminder") {
      type = "offboarding.reminder";
      title = "Offboarding Reminder";
      message = `Please complete the remaining exit steps for ${existingRequest.employee.fullName}. HR is tracking your offboarding checklist and pending handovers.`;
      responseMessage = "Offboarding reminder sent successfully.";
    } else if (input.action === "generate-letters") {
      type = "offboarding.letters-generated";
      title = "Exit Letters Prepared";
      message = `HR prepared the exit document pack for ${existingRequest.employee.fullName}. Please review the offboarding workspace for the next steps.`;
      responseMessage = "Exit letters generated successfully.";
    } else {
      return fail(400, "The requested offboarding action is invalid.");
    }

    await notificationsService.notifyUser(companyId, existingRequest.userId, {
      type,
      title,
      message,
      entityType: "offboarding_request",
      entityId: existingRequest.id,
    });

    const requestWithProgress = await hydrateRequest(companyId, existingRequest);

    void auditService.recordAction(user, {
      action: `offboarding.${input.action}`,
      entityType: "offboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
      },
    });

    return ok({
      message: responseMessage,
      request: requestWithProgress,
    });
  },

  async reviewRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ReviewOffboardingRequest,
  ): Promise<OffboardingServiceResult<OffboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await offboardingRepository.findOffboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Offboarding request not found.");
    }

    if (existingRequest.status !== "pending") {
      return fail(409, "Only pending offboarding requests can be reviewed.");
    }

    const currentProgress = await approvalsService.getEntityApprovalProgress(
      companyId,
      "offboarding",
      requestId,
    );

    if (!currentProgress) {
      return fail(409, "The offboarding approval flow could not be resolved.");
    }

    const currentStep = resolveCurrentApprovalStep(currentProgress);

    if (!currentStep || !canUserActOnApprovalStep(user.role, currentStep.role)) {
      return fail(
        409,
        "This offboarding request is not currently awaiting your review.",
      );
    }

    let requestRecord: OffboardingRequestRecord | null = null;

    try {
      requestRecord = await withTransaction(async (client) => {
        const lockedRequest = await offboardingRepository.findOffboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!lockedRequest) {
          workflowFail(404, "Offboarding request not found.");
        }

        if (lockedRequest.status !== "pending") {
          workflowFail(409, "Only pending offboarding requests can be reviewed.");
        }

        const decision = await approvalsRepository.recordApprovalDecision(client, {
          companyId,
          entityType: "offboarding",
          entityId: requestId,
          stepId: currentStep.id,
          approverId: user.id,
          status: input.status,
        });

        if (!decision) {
          workflowFail(
            409,
            "This approval step could not be updated because it is no longer pending.",
          );
        }

        const updatedProgress = await approvalsRepository.getEntityApprovalProgress(
          companyId,
          "offboarding",
          requestId,
          client,
        );

        const nextStatus =
          input.status === "rejected"
            ? "rejected"
            : updatedProgress?.status === "approved"
              ? "approved"
              : "pending";

        const updatedRequestId =
          await offboardingRepository.updateOffboardingRequestStatus(
            companyId,
            requestId,
            nextStatus,
            client,
          );

        if (!updatedRequestId) {
          workflowFail(404, "Offboarding request not found.");
        }

        const updatedRequest = await offboardingRepository.findOffboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!updatedRequest) {
          workflowFail(404, "Offboarding request not found.");
        }

        return updatedRequest;
      });
    } catch (error) {
      if (isWorkflowError(error)) {
        return fail(error.status, error.message);
      }

      throw error;
    }

    if (!requestRecord) {
      return fail(404, "Offboarding request not found.");
    }

    const requestWithProgress = await hydrateRequest(companyId, requestRecord);

    void auditService.recordAction(user, {
      action:
        requestWithProgress.status === "rejected"
          ? "offboarding.rejected"
          : requestWithProgress.status === "approved"
            ? "offboarding.approved"
            : "offboarding.reviewed",
      entityType: "offboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        decision: input.status,
        reviewRole: currentStep.role,
        assignedAssetCount: requestWithProgress.assignedAssetCount,
      },
    });

    return ok({
      message:
        requestWithProgress.status === "rejected"
          ? "Offboarding request rejected successfully."
          : requestWithProgress.status === "approved"
            ? "Offboarding request approved successfully."
            : "Offboarding step reviewed successfully.",
      request: requestWithProgress,
    });
  },

  async completeRequest(
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<OffboardingServiceResult<OffboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await offboardingRepository.findOffboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Offboarding request not found.");
    }

    if (existingRequest.status === "completed") {
      return fail(409, "This offboarding request has already been completed.");
    }

    if (existingRequest.status === "rejected") {
      return fail(409, "Rejected offboarding requests cannot be completed.");
    }

    const approvalProgress = await approvalsService.getEntityApprovalProgress(
      companyId,
      "offboarding",
      requestId,
    );

    if (!approvalProgress || approvalProgress.status !== "approved") {
      return fail(
        409,
        "The offboarding request must be approved before it can be completed.",
      );
    }

    let requestRecord: OffboardingRequestRecord | null = null;

    try {
      requestRecord = await withTransaction(async (client) => {
        const lockedRequest = await offboardingRepository.findOffboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!lockedRequest) {
          workflowFail(404, "Offboarding request not found.");
        }

        if (lockedRequest.status === "completed") {
          workflowFail(
            409,
            "This offboarding request has already been completed.",
          );
        }

        if (lockedRequest.status !== "approved") {
          workflowFail(
            409,
            "Only approved offboarding requests can be completed.",
          );
        }

        const currentAssignedAssetCount =
          await offboardingRepository.countAssignedAssetsByUser(
            companyId,
            lockedRequest.userId,
            client,
          );

        if (currentAssignedAssetCount > 0) {
          workflowFail(
            409,
            "All assigned assets must be returned before offboarding can be completed.",
          );
        }

        const deactivationResult = await client.query<{ id: string }>(
          `
            UPDATE users
            SET
              is_active = FALSE,
              updated_at = NOW()
            WHERE id = $1
              AND company_id = $2
              AND role <> 'admin'
            RETURNING id
          `,
          [lockedRequest.userId, companyId],
        );

        if (!deactivationResult.rows[0]?.id) {
          workflowFail(409, "Unable to deactivate the employee account.");
        }

        const updatedRequestId =
          await offboardingRepository.completeOffboardingRequest(
            companyId,
            requestId,
            user.id,
            client,
          );

        if (!updatedRequestId) {
          workflowFail(404, "Offboarding request not found.");
        }

        const updatedRequest = await offboardingRepository.findOffboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!updatedRequest) {
          workflowFail(404, "Offboarding request not found.");
        }

        return updatedRequest;
      });
    } catch (error) {
      if (isWorkflowError(error)) {
        return fail(error.status, error.message);
      }

      throw error;
    }

    if (!requestRecord) {
      return fail(404, "Offboarding request not found.");
    }

    const requestWithProgress = await hydrateRequest(companyId, requestRecord);

    void auditService.recordAction(user, {
      action: "offboarding.completed",
      entityType: "offboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        completedBy: requestWithProgress.completedBy,
        completedAt: requestWithProgress.completedAt,
        assignedAssetCount: requestWithProgress.assignedAssetCount,
        deactivated: true,
      },
    });

    return ok({
      message: "Offboarding request completed successfully.",
      request: requestWithProgress,
    });
  },
};
