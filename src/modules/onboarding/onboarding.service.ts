import { withTransaction, type DatabaseExecutor } from "../../database/index.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import {
  approvalsRepository,
  approvalsService,
  canUserActOnApprovalStep,
  resolveCurrentApprovalStep,
} from "../approvals/approvals.service.js";
import { assetsRepository } from "../assets/assets.repository.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import { designationsService } from "../designations/designations.service.js";
import {
  employeeSelfRepository,
} from "../employee-self/employee-self.repository.js";
import {
  isEmployeeProfileEmploymentType,
  type EmployeeSelfProfile,
} from "../employee-self/employee-self.types.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { usersRepository } from "../users/users.repository.js";
import { onboardingRepository } from "./onboarding.repository.js";
import type {
  CreateOnboardingRequest,
  OnboardingChecklistItem,
  OnboardingChecklistSummary,
  OnboardingDocumentOverview,
  OnboardingMutationResponse,
  OnboardingNextAction,
  OnboardingRequestRecord,
  OnboardingRequestStatus,
  OnboardingServiceResult,
  OnboardingWorkspaceResponse,
  ReviewOnboardingRequest,
  TriggerOnboardingRequestAction,
  UpdateOnboardingRequestDetails,
} from "./onboarding.types.js";

const REQUIRED_ONBOARDING_DOCUMENTS = 12;

function ok<T>(data: T): OnboardingServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): OnboardingServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function normalizeStatusFilter(value?: string | null): OnboardingRequestStatus | null {
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

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
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

function hasResolvedProfileDetails(request: OnboardingRequestRecord) {
  return Boolean(
    request.employee.personalEmail &&
      request.employee.phone &&
      request.employee.department?.id &&
      request.employee.designation?.id &&
      request.employee.reportingManager?.id &&
      request.employee.employmentType &&
      request.joiningDate,
  );
}

function buildDocumentOverview(
  request: OnboardingRequestRecord,
): OnboardingDocumentOverview {
  const uploaded = request.documentCount;
  const pending = Math.max(REQUIRED_ONBOARDING_DOCUMENTS - uploaded, 0);
  const verified =
    request.status === "approved" || request.status === "completed"
      ? Math.min(uploaded, REQUIRED_ONBOARDING_DOCUMENTS)
      : uploaded > 0 && request.status === "pending"
        ? Math.min(Math.max(Math.floor(uploaded / 2), 1), uploaded)
        : 0;
  const rejected =
    request.status === "rejected"
      ? Math.max(1, Math.min(REQUIRED_ONBOARDING_DOCUMENTS - verified, REQUIRED_ONBOARDING_DOCUMENTS))
      : 0;

  return {
    required: REQUIRED_ONBOARDING_DOCUMENTS,
    uploaded,
    verified,
    rejected,
    pending,
  };
}

function buildVerificationStatus(
  request: OnboardingRequestRecord,
  documentOverview: OnboardingDocumentOverview,
): OnboardingRequestRecord["verificationStatus"] {
  if (request.status === "rejected") {
    return "rejected";
  }

  if (request.status === "completed") {
    return "completed";
  }

  if (request.status === "approved") {
    return "ready-to-join";
  }

  if (documentOverview.uploaded === 0) {
    return "document-pending";
  }

  return "verification-pending";
}

function buildChecklist(
  request: OnboardingRequestRecord,
  input: {
    assignedAssetsCount: number;
    hasBankDetails: boolean;
  },
): OnboardingChecklistSummary {
  const documentOverview = buildDocumentOverview(request);
  const profileReady = hasResolvedProfileDetails(request);
  const documentsUploaded = documentOverview.uploaded > 0;
  const documentsVerified =
    request.status === "approved" || request.status === "completed";
  const joiningCompleted = request.status === "completed";
  const hasEmployeeId = Boolean(request.employee.employeeId);
  const payrollReady =
    input.hasBankDetails && (request.status === "approved" || request.status === "completed");

  const items: OnboardingChecklistItem[] = [
    {
      key: "offer-letter",
      label: "Offer Letter Sent",
      status: "completed",
      helper: "This onboarding request has been created for the employee.",
    },
    {
      key: "offer-accepted",
      label: "Offer Accepted",
      status: documentsUploaded || documentsVerified ? "completed" : "in-progress",
      helper: "The onboarding workflow is now active in the HR workspace.",
    },
    {
      key: "personal-details",
      label: "Personal Detail Submitted",
      status: profileReady ? "completed" : "in-progress",
      helper: profileReady
        ? "Core joining information is captured for this employee."
        : "Complete the required onboarding details before final activation.",
    },
    {
      key: "documents-uploaded",
      label: "Documents Uploaded",
      status: documentsUploaded ? "completed" : "pending",
      helper: `${documentOverview.uploaded} onboarding document${
        documentOverview.uploaded === 1 ? "" : "s"
      } currently linked.`,
    },
    {
      key: "documents-verified",
      label: "Documents Verified",
      status: documentsVerified
        ? "completed"
        : documentsUploaded
          ? "in-progress"
          : "pending",
      helper: documentsVerified
        ? "Document verification has been completed for this request."
        : "Use the review step after the employee uploads required documents.",
    },
    {
      key: "employee-id",
      label: "Employee ID Generated",
      status: hasEmployeeId ? "completed" : "pending",
      helper: hasEmployeeId
        ? `Employee ID ${request.employee.employeeId} is already assigned.`
        : "Assign the employee identifier before final onboarding completion.",
    },
    {
      key: "official-email",
      label: "Official Email Created",
      status: request.employee.email ? "completed" : "pending",
      helper: "The company email already exists on the employee account.",
    },
    {
      key: "asset-assigned",
      label: "Asset Assigned",
      status:
        input.assignedAssetsCount > 0
          ? "completed"
          : request.status === "approved" || request.status === "completed"
            ? "in-progress"
            : "pending",
      helper:
        input.assignedAssetsCount > 0
          ? `${input.assignedAssetsCount} company asset${
              input.assignedAssetsCount === 1 ? "" : "s"
            } assigned.`
          : "Assign company assets once document verification is cleared.",
    },
    {
      key: "training-scheduled",
      label: "Training Scheduled",
      status:
        request.status === "approved" || request.status === "completed"
          ? "in-progress"
          : "pending",
      helper: "Training scheduling is still pending in the onboarding timeline.",
    },
    {
      key: "bank-details",
      label: "Bank Details Added",
      status: input.hasBankDetails ? "completed" : "pending",
      helper: input.hasBankDetails
        ? "Bank details are available for payroll readiness."
        : "Bank details are still missing from the employee profile.",
    },
    {
      key: "payroll-setup",
      label: "Payroll Setup Done",
      status: payrollReady ? "completed" : input.hasBankDetails ? "in-progress" : "pending",
      helper: payrollReady
        ? "Payroll prerequisites are ready from the current onboarding data."
        : "Payroll setup becomes ready after bank details and verification are in place.",
    },
    {
      key: "welcome-kit",
      label: "Welcome Kit Sent",
      status:
        input.assignedAssetsCount > 0 && request.status === "completed"
          ? "completed"
          : input.assignedAssetsCount > 0
            ? "in-progress"
            : "pending",
      helper: "Welcome kit dispatch remains a final pre-joining action.",
    },
    {
      key: "joining-completed",
      label: "Joining Completed",
      status:
        joiningCompleted
          ? "completed"
          : request.status === "approved"
            ? "in-progress"
            : "pending",
      helper: joiningCompleted
        ? "Employee activation and onboarding completion are done."
        : "Use complete onboarding after all pre-joining requirements clear.",
    },
  ];

  const completedCount = items.filter((item) => item.status === "completed").length;
  const totalCount = items.length;

  return {
    items,
    completedCount,
    totalCount,
    progressPercent:
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
  };
}

function buildNextActions(
  request: OnboardingRequestRecord,
  input: {
    documentOverview: OnboardingDocumentOverview;
    assignedAssetsCount: number;
    hasBankDetails: boolean;
  },
): OnboardingNextAction[] {
  const actions: OnboardingNextAction[] = [];

  if (input.documentOverview.uploaded === 0) {
    actions.push({
      id: `${request.id}:documents-upload`,
      label: "Collect required documents",
      description: "Request the employee to upload their onboarding files.",
      tone: "warning",
    });
  } else if (request.status === "pending") {
    actions.push({
      id: `${request.id}:documents-review`,
      label: "Review uploaded documents",
      description: "Document uploads are available and waiting for HR verification.",
      tone: "neutral",
    });
  }

  if (!input.hasBankDetails) {
    actions.push({
      id: `${request.id}:bank-details`,
      label: "Add bank details",
      description: "Bank details are still missing for payroll readiness.",
      tone: "warning",
    });
  }

  if (input.assignedAssetsCount === 0) {
    actions.push({
      id: `${request.id}:assets`,
      label: "Assign employee assets",
      description: "No company assets are currently assigned to this employee.",
      tone: "neutral",
    });
  }

  if (request.status === "approved") {
    actions.push({
      id: `${request.id}:complete`,
      label: "Complete onboarding",
      description: "All approvals are clear, so the employee can now be activated.",
      tone: "success",
    });
  }

  if (request.status === "rejected") {
    actions.push({
      id: `${request.id}:resolve-rejection`,
      label: "Resolve rejected verification",
      description: "Correct the rejected onboarding data or documents before retrying.",
      tone: "warning",
    });
  }

  return actions.slice(0, 4);
}

function buildSummary(items: readonly OnboardingRequestRecord[]) {
  const now = new Date();

  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => item.status === "pending").length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
    completedRequests: items.filter((item) => item.status === "completed").length,
    readyToCompleteRequests: items.filter((item) => item.status === "approved").length,
    newJoinersThisMonth: items.filter((item) =>
      isSameMonth(item.joiningDate ?? item.createdAt, now),
    ).length,
    pendingDocuments: items.filter((item) => item.documentOverview.pending > 0).length,
    verificationPending: items.filter(
      (item) => item.verificationStatus === "verification-pending",
    ).length,
    readyToJoin: items.filter((item) => item.verificationStatus === "ready-to-join")
      .length,
    completedThisMonth: items.filter(
      (item) => item.status === "completed" && isSameMonth(item.updatedAt, now),
    ).length,
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
  const [department, designation] = await Promise.all([
    departmentsService.findCompanyDepartmentById(companyId, input.departmentId),
    designationsService.findCompanyDesignationById(companyId, input.designationId),
  ]);

  if (!department) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Department not found for this company.",
    };
  }

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

async function resolveOnboardingDetailsInput(
  companyId: string,
  userId: string,
  input: {
    personalEmail: string;
    phone: string;
    departmentId: string;
    designationId: string;
    reportingManagerId: string;
    joiningDate: string;
    employmentType: string;
  },
) {
  if (!isEmail(input.personalEmail)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "A valid personal email address is required.",
    };
  }

  if (!isPhoneNumber(input.phone)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Phone must contain 7 to 20 characters using digits and standard phone symbols only.",
    };
  }

  if (!isDateOnly(input.joiningDate)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Joining date must use the YYYY-MM-DD format.",
    };
  }

  if (!isEmployeeProfileEmploymentType(input.employmentType)) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "Employment type must match a supported employee employment type.",
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
      personalEmail: input.personalEmail.toLowerCase(),
      phone: input.phone,
      departmentId: assignmentResult.data.departmentId,
      designationId: assignmentResult.data.designationId,
      reportingManagerId: managerResult.data.id,
      joiningDate: input.joiningDate,
      employmentType: input.employmentType,
    },
  };
}

function buildProfileUpdatePayload(
  currentProfile: EmployeeSelfProfile,
  input: {
    personalEmail: string;
    phone: string;
  },
) {
  return {
    phone: input.phone,
    personalEmail: input.personalEmail,
    emergencyContactName: currentProfile.emergencyContactName,
    emergencyContactPhone: currentProfile.emergencyContactPhone,
    address: currentProfile.address,
    dateOfBirth: currentProfile.dateOfBirth,
    gender: currentProfile.gender,
    maritalStatus: currentProfile.maritalStatus,
    bloodGroup: currentProfile.bloodGroup,
    nationality: currentProfile.nationality,
    languages: currentProfile.languages,
    bio: currentProfile.bio,
    linkedinUrl: currentProfile.linkedinUrl,
    githubUrl: currentProfile.githubUrl,
  };
}

async function applyEmployeeOnboardingDetails(
  companyId: string,
  userId: string,
  input: {
    personalEmail: string;
    phone: string;
    departmentId: string;
    designationId: string;
    reportingManagerId: string;
    employmentType: EmployeeSelfProfile["employmentType"];
  },
  executor: DatabaseExecutor,
) {
  const currentProfile = await employeeSelfRepository.findSelfProfile(
    companyId,
    userId,
    executor,
  );

  if (!currentProfile) {
    throw new Error("Employee profile not found.");
  }

  await employeeSelfRepository.updateSelfProfile(
    companyId,
    userId,
    buildProfileUpdatePayload(currentProfile, {
      personalEmail: input.personalEmail,
      phone: input.phone,
    }),
    executor,
  );

  await employeeSelfRepository.updateApprovedJobInformation(
    companyId,
    userId,
    {
      employeeId: currentProfile.employeeId,
      reportingManagerId: input.reportingManagerId,
      workLocation: currentProfile.workLocation,
      employmentType: input.employmentType,
    },
    executor,
  );

  await usersRepository.updateCompanyUserOrganizationProfile(
    companyId,
    userId,
    {
      departmentId: input.departmentId,
      designationId: input.designationId,
    },
    executor,
  );
}

async function enrichRequests(
  companyId: string,
  requests: readonly OnboardingRequestRecord[],
) {
  if (requests.length === 0) {
    return [];
  }

  const [assets, bankDetails] = await Promise.all([
    assetsRepository.listCompanyAssets(companyId),
    Promise.all(
      Array.from(new Set(requests.map((request) => request.userId))).map(
        async (userId) => [
          userId,
          await employeeSelfRepository.findSelfBankDetails(companyId, userId),
        ] as const,
      ),
    ),
  ]);

  const assignedAssetsByUserId = new Map<string, number>();

  for (const asset of assets) {
    if (asset.status !== "assigned" || !asset.assignedToUserId) {
      continue;
    }

    assignedAssetsByUserId.set(
      asset.assignedToUserId,
      (assignedAssetsByUserId.get(asset.assignedToUserId) ?? 0) + 1,
    );
  }

  const bankDetailsByUserId = new Map(
    bankDetails.map(([userId, details]) => [userId, details]),
  );

  return requests.map((request) => {
    const assignedAssetsCount = assignedAssetsByUserId.get(request.userId) ?? 0;
    const hasBankDetails = Boolean(bankDetailsByUserId.get(request.userId));
    const documentOverview = buildDocumentOverview(request);
    const verificationStatus = buildVerificationStatus(request, documentOverview);
    const checklist = buildChecklist(request, {
      assignedAssetsCount,
      hasBankDetails,
    });
    const nextActions = buildNextActions(request, {
      documentOverview,
      assignedAssetsCount,
      hasBankDetails,
    });

    return {
      ...request,
      checklist,
      documentOverview,
      nextActions,
      verificationStatus,
      assignedAssetsCount,
      hasBankDetails,
    };
  });
}

async function hydrateRequest(
  companyId: string,
  request: OnboardingRequestRecord,
) {
  const [requestWithProgress] = await approvalsService.attachEntityApprovalProgress(
    companyId,
    "onboarding",
    [request],
  );
  const [enhancedRequest] = await enrichRequests(companyId, [requestWithProgress]);

  return enhancedRequest;
}

async function buildWorkspace(
  user: AuthenticatedUser,
  filters: {
    userId?: string | null;
    status?: string | null;
  },
): Promise<OnboardingWorkspaceResponse | null> {
  if (!user.companyId) {
    return null;
  }

  const [company, rawRequests, candidateProfiles, profiles, departments, designations] =
    await Promise.all([
      ensureCompanyContext(user),
      onboardingRepository.listOnboardingRequests(user.companyId),
      onboardingRepository.listOnboardingCandidates(user.companyId),
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
    "onboarding",
    filteredRequests,
  );
  const enrichedRequests = await enrichRequests(user.companyId, requestsWithProgress);

  const activeRequestUserIds = new Set(
    rawRequests
      .filter((request) => request.status === "pending" || request.status === "approved")
      .map((request) => request.userId),
  );

  const availableUsers = candidateProfiles
    .filter((profile) => profile.status === "inactive")
    .filter((profile) => !activeRequestUserIds.has(profile.id))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const managers = profiles
    .filter((profile) => profile.status === "active")
    .filter((profile) => profile.role !== "employee")
    .map((profile) => ({
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: buildSummary(enrichedRequests),
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

export const onboardingService = {
  async getWorkspace(
    user: AuthenticatedUser,
    filters: {
      userId?: string | null;
      status?: string | null;
    } = {},
  ): Promise<OnboardingServiceResult<OnboardingWorkspaceResponse>> {
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
    input: CreateOnboardingRequest,
  ): Promise<OnboardingServiceResult<OnboardingMutationResponse>> {
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

    if (targetEmployee.role !== "employee") {
      return fail(409, "Onboarding can only be created for employee accounts.");
    }

    if (targetEmployee.status !== "inactive") {
      return fail(
        409,
        "Onboarding can only be created for inactive employee accounts.",
      );
    }

    const existingActiveRequest =
      await onboardingRepository.findActiveOnboardingRequestByUserId(
        companyId,
        input.userId,
      );

    if (existingActiveRequest) {
      return fail(
        409,
        "An active onboarding request already exists for this employee.",
      );
    }

    const resolvedDetails = await resolveOnboardingDetailsInput(companyId, input.userId, {
      personalEmail: input.personalEmail,
      phone: input.phone,
      departmentId: input.departmentId,
      designationId: input.designationId,
      reportingManagerId: input.reportingManagerId,
      joiningDate: input.joiningDate,
      employmentType: input.employmentType,
    });

    if (!resolvedDetails.ok) {
      return fail(resolvedDetails.status, resolvedDetails.message);
    }

    const approvalFlow = await approvalsService.ensureOnboardingFlow(companyId);

    if (!approvalFlow) {
      return fail(409, "Unable to resolve the active onboarding approval flow.");
    }

    let requestRecord: OnboardingRequestRecord | null = null;

    try {
      const transactionResult = await withTransaction(async (client) => {
        await applyEmployeeOnboardingDetails(
          companyId,
          input.userId,
          {
            personalEmail: resolvedDetails.data.personalEmail,
            phone: resolvedDetails.data.phone,
            departmentId: resolvedDetails.data.departmentId,
            designationId: resolvedDetails.data.designationId,
            reportingManagerId: resolvedDetails.data.reportingManagerId,
            employmentType: resolvedDetails.data.employmentType,
          },
          client,
        );

        const requestId = await onboardingRepository.createOnboardingRequest(
          {
            companyId,
            userId: input.userId,
            joiningDate: resolvedDetails.data.joiningDate,
            assignedHrUserId: user.id,
          },
          client,
        );

        if (!requestId) {
          return {
            ok: false as const,
            status: 409 as const,
            message: "Unable to create the onboarding request.",
          };
        }

        const approvalRequestId = await approvalsRepository.createApprovalChainForEntity(
          client,
          "onboarding",
          requestId,
          approvalFlow,
          user.id,
        );

        if (!approvalRequestId) {
          return {
            ok: false as const,
            status: 409 as const,
            message:
              "Unable to resolve an approver for the active onboarding approval flow.",
          };
        }

        const createdRequest = await onboardingRepository.findOnboardingRequestById(
          companyId,
          requestId,
          client,
        );

        if (!createdRequest) {
          return {
            ok: false as const,
            status: 404 as const,
            message: "Onboarding request not found.",
          };
        }

        return {
          ok: true as const,
          request: createdRequest,
        };
      });

      if (!transactionResult.ok) {
        return fail(transactionResult.status, transactionResult.message);
      }

      requestRecord = transactionResult.request;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "An active onboarding request already exists for this employee.",
        );
      }

      throw error;
    }

    if (!requestRecord) {
      return fail(404, "Onboarding request not found.");
    }

    const requestWithProgress = await hydrateRequest(companyId, requestRecord);

    void auditService.recordAction(user, {
      action: "onboarding.request.created",
      entityType: "onboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        joiningDate: requestWithProgress.joiningDate,
        documentCount: requestWithProgress.documentCount,
      },
    });

    return ok({
      message: "Onboarding request created successfully.",
      request: requestWithProgress,
    });
  },

  async updateRequestDetails(
    user: AuthenticatedUser,
    requestId: string,
    input: UpdateOnboardingRequestDetails,
  ): Promise<OnboardingServiceResult<OnboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await onboardingRepository.findOnboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Onboarding request not found.");
    }

    if (existingRequest.status === "completed") {
      return fail(409, "Completed onboarding requests cannot be edited.");
    }

    const mergedInput = {
      personalEmail:
        normalizeOptionalString(input.personalEmail) ??
        existingRequest.employee.personalEmail ??
        "",
      phone:
        normalizeOptionalString(input.phone) ?? existingRequest.employee.phone ?? "",
      departmentId:
        normalizeOptionalString(input.departmentId) ??
        existingRequest.employee.department?.id ??
        "",
      designationId:
        normalizeOptionalString(input.designationId) ??
        existingRequest.employee.designation?.id ??
        "",
      reportingManagerId:
        normalizeOptionalString(input.reportingManagerId) ??
        existingRequest.employee.reportingManager?.id ??
        "",
      joiningDate:
        normalizeOptionalString(input.joiningDate) ?? existingRequest.joiningDate ?? "",
      employmentType:
        normalizeOptionalString(input.employmentType) ??
        existingRequest.employee.employmentType ??
        "",
    };

    const resolvedDetails = await resolveOnboardingDetailsInput(
      companyId,
      existingRequest.userId,
      mergedInput,
    );

    if (!resolvedDetails.ok) {
      return fail(resolvedDetails.status, resolvedDetails.message);
    }

    const transactionResult = await withTransaction(async (client) => {
      await applyEmployeeOnboardingDetails(
        companyId,
        existingRequest.userId,
        {
          personalEmail: resolvedDetails.data.personalEmail,
          phone: resolvedDetails.data.phone,
          departmentId: resolvedDetails.data.departmentId,
          designationId: resolvedDetails.data.designationId,
          reportingManagerId: resolvedDetails.data.reportingManagerId,
          employmentType: resolvedDetails.data.employmentType,
        },
        client,
      );

      const updatedRequestId = await onboardingRepository.updateOnboardingRequestDetails(
        companyId,
        requestId,
        {
          joiningDate: resolvedDetails.data.joiningDate,
        },
        client,
      );

      if (!updatedRequestId) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
        };
      }

      const updatedRequest = await onboardingRepository.findOnboardingRequestById(
        companyId,
        requestId,
        client,
      );

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
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

    const requestWithProgress = await hydrateRequest(companyId, transactionResult.request);

    void auditService.recordAction(user, {
      action: "onboarding.request.details.updated",
      entityType: "onboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        joiningDate: requestWithProgress.joiningDate,
      },
    });

    return ok({
      message: "Onboarding details updated successfully.",
      request: requestWithProgress,
    });
  },

  async triggerRequestAction(
    user: AuthenticatedUser,
    requestId: string,
    input: TriggerOnboardingRequestAction,
  ): Promise<OnboardingServiceResult<OnboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await onboardingRepository.findOnboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Onboarding request not found.");
    }

    let title = "";
    let message = "";
    let responseMessage = "";

    if (input.action === "send-reminder") {
      title = "Onboarding Reminder";
      message = `Please continue your onboarding steps for ${existingRequest.employee.fullName}. HR is waiting on the remaining actions for your joining process.`;
      responseMessage = "Onboarding reminder sent successfully.";
    } else if (input.action === "send-upload-link") {
      title = "Upload Your Onboarding Documents";
      message = `Your HR team has asked you to upload the remaining onboarding documents for ${existingRequest.employee.fullName}.`;
      responseMessage = "Document upload prompt sent successfully.";
    } else if (input.action === "request-document") {
      title = "Additional Document Required";
      message = `HR requested additional onboarding documents for ${existingRequest.employee.fullName}. Please review your document workspace and upload the pending files.`;
      responseMessage = "Document request sent successfully.";
    } else {
      return fail(400, "The requested onboarding action is invalid.");
    }

    await notificationsService.notifyUser(companyId, existingRequest.userId, {
      type:
        input.action === "send-reminder"
          ? "onboarding.reminder"
          : input.action === "send-upload-link"
            ? "onboarding.upload-link"
            : "onboarding.document-request",
      title,
      message,
      entityType: "onboarding_request",
      entityId: existingRequest.id,
    });

    const requestWithProgress = await hydrateRequest(companyId, existingRequest);

    void auditService.recordAction(user, {
      action: `onboarding.${input.action}`,
      entityType: "onboarding_request",
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
    input: ReviewOnboardingRequest,
  ): Promise<OnboardingServiceResult<OnboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await onboardingRepository.findOnboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Onboarding request not found.");
    }

    if (existingRequest.status !== "pending") {
      return fail(409, "Only pending onboarding requests can be reviewed.");
    }

    const currentProgress = await approvalsService.getEntityApprovalProgress(
      companyId,
      "onboarding",
      requestId,
    );

    if (!currentProgress) {
      return fail(409, "The onboarding approval flow could not be resolved.");
    }

    const currentStep = resolveCurrentApprovalStep(currentProgress);

    if (!currentStep || !canUserActOnApprovalStep(user.role, currentStep.role)) {
      return fail(
        409,
        "This onboarding request is not currently awaiting your review.",
      );
    }

    const transactionResult = await withTransaction(async (client) => {
      const lockedRequest = await onboardingRepository.findOnboardingRequestById(
        companyId,
        requestId,
        client,
      );

      if (!lockedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
        };
      }

      if (lockedRequest.status !== "pending") {
        return {
          ok: false as const,
          status: 409 as const,
          message: "Only pending onboarding requests can be reviewed.",
        };
      }

      const decision = await approvalsRepository.recordApprovalDecision(client, {
        companyId,
        entityType: "onboarding",
        entityId: requestId,
        stepId: currentStep.id,
        approverId: user.id,
        status: input.status,
      });

      if (!decision) {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "This approval step could not be updated because it is no longer pending.",
        };
      }

      const updatedProgress = await approvalsRepository.getEntityApprovalProgress(
        companyId,
        "onboarding",
        requestId,
        client,
      );

      const nextStatus =
        input.status === "rejected"
          ? "rejected"
          : updatedProgress?.status === "approved"
            ? "approved"
            : "pending";

      const updatedRequestId = await onboardingRepository.updateOnboardingRequestStatus(
        companyId,
        requestId,
        nextStatus,
        client,
      );

      if (!updatedRequestId) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
        };
      }

      const updatedRequest = await onboardingRepository.findOnboardingRequestById(
        companyId,
        requestId,
        client,
      );

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
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

    const requestWithProgress = await hydrateRequest(companyId, transactionResult.request);

    void auditService.recordAction(user, {
      action:
        requestWithProgress.status === "rejected"
          ? "onboarding.rejected"
          : requestWithProgress.status === "approved"
            ? "onboarding.approved"
            : "onboarding.reviewed",
      entityType: "onboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        decision: input.status,
        reviewRole: currentStep.role,
        documentCount: requestWithProgress.documentCount,
      },
    });

    return ok({
      message:
        requestWithProgress.status === "rejected"
          ? "Onboarding request rejected successfully."
          : requestWithProgress.status === "approved"
            ? "Onboarding request approved successfully."
            : "Onboarding step reviewed successfully.",
      request: requestWithProgress,
    });
  },

  async completeRequest(
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<OnboardingServiceResult<OnboardingMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingRequest = await onboardingRepository.findOnboardingRequestById(
      companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Onboarding request not found.");
    }

    if (existingRequest.status === "completed") {
      return fail(409, "This onboarding request has already been completed.");
    }

    if (existingRequest.status === "rejected") {
      return fail(409, "Rejected onboarding requests cannot be completed.");
    }

    const approvalProgress = await approvalsService.getEntityApprovalProgress(
      companyId,
      "onboarding",
      requestId,
    );

    if (!approvalProgress || approvalProgress.status !== "approved") {
      return fail(
        409,
        "The onboarding request must be approved before it can be completed.",
      );
    }

    let activated = false;

    const transactionResult = await withTransaction(async (client) => {
      const lockedRequest = await onboardingRepository.findOnboardingRequestById(
        companyId,
        requestId,
        client,
      );

      if (!lockedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
        };
      }

      if (lockedRequest.status === "completed") {
        return {
          ok: false as const,
          status: 409 as const,
          message: "This onboarding request has already been completed.",
        };
      }

      if (lockedRequest.status !== "approved") {
        return {
          ok: false as const,
          status: 409 as const,
          message: "Only approved onboarding requests can be completed.",
        };
      }

      const activationResult = await client.query<{ id: string }>(
        `
          UPDATE users
          SET
            is_active = TRUE,
            updated_at = NOW()
          WHERE id = $1
            AND company_id = $2
            AND role = 'employee'
          RETURNING id
        `,
        [lockedRequest.userId, companyId],
      );

      activated = activationResult.rows[0]?.id !== undefined;

      const updatedRequestId = await onboardingRepository.updateOnboardingRequestStatus(
        companyId,
        requestId,
        "completed",
        client,
      );

      if (!updatedRequestId) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
        };
      }

      const updatedRequest = await onboardingRepository.findOnboardingRequestById(
        companyId,
        requestId,
        client,
      );

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Onboarding request not found.",
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

    const requestWithProgress = await hydrateRequest(companyId, transactionResult.request);

    void notificationsService.notifyUser(companyId, requestWithProgress.userId, {
      type: "onboarding.completed",
      title: "Onboarding Completed",
      message: `Your onboarding has been completed and your employee account is now active.`,
      entityType: "onboarding_request",
      entityId: requestWithProgress.id,
    });

    void auditService.recordAction(user, {
      action: "onboarding.completed",
      entityType: "onboarding_request",
      entityId: requestWithProgress.id,
      metadata: {
        employee: requestWithProgress.employee,
        documentCount: requestWithProgress.documentCount,
        activated,
      },
    });

    return ok({
      message: "Onboarding request completed successfully.",
      request: requestWithProgress,
    });
  },
};
