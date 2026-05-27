import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { approvalsRepository } from "./approvals.repository.js";
import {
  type ApprovalFlowMutationResponse,
  type ApprovalFlowSummary,
  type ApprovalEntityType,
  type ApprovalProgress,
  type ApprovalStepRole,
  type ApprovalServiceResult,
  type ApprovalWorkspaceResponse,
} from "./approvals.types.js";
import type {
  CreateApprovalFlowRequest,
  UpdateApprovalFlowRequest,
} from "./approvals.validation.js";

export { approvalsRepository };

function ok<T>(data: T): ApprovalServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): ApprovalServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function buildSummary(flows: readonly ApprovalFlowSummary[]) {
  return {
    totalFlows: flows.length,
    activeFlows: flows.filter((flow) => flow.isActive).length,
    archivedFlows: flows.filter((flow) => !flow.isActive).length,
    totalSteps: flows.reduce((count, flow) => count + flow.steps.length, 0),
  };
}

export function isManagerApprovalRole(role: string) {
  return role === "project-manager" || role === "team-lead";
}

export function canUserActOnApprovalStep(
  userRole: string,
  stepRole: ApprovalStepRole,
) {
  if (stepRole === "manager") {
    return isManagerApprovalRole(userRole);
  }

  return userRole === stepRole;
}

export function resolveCurrentApprovalStep(progress: ApprovalProgress | null) {
  if (!progress) {
    return null;
  }

  return progress.steps.find((step) => step.isCurrent) ?? null;
}

export async function attachEntityApprovalProgress<
  T extends { id: string },
>(
  companyId: string,
  entityType: ApprovalEntityType,
  items: readonly T[],
) {
  const progressMap = await approvalsRepository.listEntityApprovalProgress(
    companyId,
    entityType,
    items.map((item) => item.id),
  );

  return items.map((item) => ({
    ...item,
    approvalProgress: progressMap.get(item.id) ?? null,
  }));
}

export async function attachLeaveApprovalProgress<T extends { id: string }>(
  companyId: string,
  items: readonly T[],
) {
  return attachEntityApprovalProgress(companyId, "leave", items);
}

export const approvalsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<ApprovalServiceResult<ApprovalWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, flows] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      approvalsRepository.listApprovalFlows(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      summary: buildSummary(flows),
      entityTypes: approvalsRepository.listEntityTypes(),
      roleOptions: approvalsRepository.listRoleOptions(),
      flows,
    });
  },

  async createFlow(
    user: AuthenticatedUser,
    input: CreateApprovalFlowRequest,
  ): Promise<ApprovalServiceResult<ApprovalFlowMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    let flow: ApprovalFlowSummary | null = null;

    try {
      flow = await approvalsRepository.createApprovalFlow(
        user.companyId,
        input,
      );
    } catch {
      return fail(409, "Unable to create the approval flow.");
    }

    if (!flow) {
      return fail(409, "Unable to create the approval flow.");
    }

    return ok({
      message: "Approval flow created successfully.",
      flow,
    });
  },

  async updateFlow(
    user: AuthenticatedUser,
    flowId: string,
    input: UpdateApprovalFlowRequest,
  ): Promise<ApprovalServiceResult<ApprovalFlowMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingFlow = await approvalsRepository.findApprovalFlowById(
      user.companyId,
      flowId,
    );

    if (!existingFlow || !existingFlow.isActive) {
      return fail(404, "Approval flow not found.");
    }

    let updatedFlow: ApprovalFlowSummary | null = null;

    try {
      updatedFlow = await approvalsRepository.updateApprovalFlow(
        user.companyId,
        flowId,
        input,
      );
    } catch {
      return fail(409, "Unable to update the approval flow.");
    }

    if (!updatedFlow) {
      return fail(404, "Approval flow not found.");
    }

    return ok({
      message: "Approval flow updated successfully.",
      flow: updatedFlow,
    });
  },

  async ensureLeaveFlow(companyId: string) {
    return approvalsRepository.ensureActiveLeaveFlow(companyId);
  },

  async attachLeaveApprovalProgress<T extends { id: string }>(
    companyId: string,
    items: readonly T[],
  ) {
    return attachLeaveApprovalProgress(companyId, items);
  },

  async attachEntityApprovalProgress<T extends { id: string }>(
    companyId: string,
    entityType: ApprovalEntityType,
    items: readonly T[],
  ) {
    return attachEntityApprovalProgress(companyId, entityType, items);
  },

  async getLeaveApprovalProgress(
    companyId: string,
    entityId: string,
  ): Promise<ApprovalProgress | null> {
    return approvalsRepository.getEntityApprovalProgress(
      companyId,
      "leave",
      entityId,
    );
  },

  async getEntityApprovalProgress(
    companyId: string,
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<ApprovalProgress | null> {
    return approvalsRepository.getEntityApprovalProgress(
      companyId,
      entityType,
      entityId,
    );
  },

  async getLeaveApprovalProgressMap(
    companyId: string,
    entityIds: readonly string[],
  ) {
    return approvalsRepository.listEntityApprovalProgress(
      companyId,
      "leave",
      entityIds,
    );
  },

  async getEntityApprovalProgressMap(
    companyId: string,
    entityType: ApprovalEntityType,
    entityIds: readonly string[],
  ) {
    return approvalsRepository.listEntityApprovalProgress(
      companyId,
      entityType,
      entityIds,
    );
  },

  async isDepartmentManagerApprover(user: AuthenticatedUser) {
    return isManagerApprovalRole(user.role);
  },

  async ensureOnboardingFlow(companyId: string) {
    return approvalsRepository.ensureActiveOnboardingFlow(companyId);
  },

  async ensureOffboardingFlow(companyId: string) {
    return approvalsRepository.ensureActiveOffboardingFlow(companyId);
  },

  async ensureAttendanceCorrectionFlow(companyId: string) {
    return approvalsRepository.ensureActiveAttendanceCorrectionFlow(companyId);
  },
};
