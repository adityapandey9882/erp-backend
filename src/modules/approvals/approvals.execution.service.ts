import { query, withTransaction } from "../../database/index.js";
import { auditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { isAppRole } from "../roles/roles.types.js";
import { approvalsRepository, resolveCurrentApprovalStep } from "./approvals.service.js";
import {
  APPROVAL_REQUEST_STATUSES,
  DEFAULT_APPROVAL_ENTITY_TYPE_LABELS,
  isApprovalEntityType,
  type ApprovalApproverSummary,
  type ApprovalDecisionPayload,
  type ApprovalMyRequestsResponse,
  type ApprovalProgress,
  type ApprovalRequestDetailResponse,
  type ApprovalRequestListFilters,
  type ApprovalRequestListResponse,
  type ApprovalRequestMutationResponse,
  type ApprovalRequestStatus,
  type ApprovalRequestView,
  type ApprovalServiceResult,
  type CreateApprovalRequestPayload,
} from "./approvals.types.js";

type RequestRow = {
  id: string;
  companyId: string;
  flowId: string;
  module: string;
  entityId: string;
  status: string;
  currentStep: number;
  createdById: string | null;
  createdByFullName: string | null;
  createdByEmail: string | null;
  createdByRole: string | null;
  flowName: string;
  flowEntityType: string;
  flowIsActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type RequestSummaryRow = {
  totalRequests: number;
  pendingRequests: number;
  inProgressRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  offset: number;
};

function ok<T>(data: T): ApprovalServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): ApprovalServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeTextFilter(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePagination(page?: number | null, pageSize?: number | null): Pagination {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  const safePageSize =
    Number.isInteger(pageSize) && (pageSize as number) > 0
      ? Math.min(pageSize as number, 50)
      : 10;

  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}

function normalizeStatusFilter(
  value?: string | null,
): ApprovalRequestStatus | "pending" | "completed" | "all" | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "pending" ||
    normalized === "completed" ||
    normalized === "all" ||
    APPROVAL_REQUEST_STATUSES.includes(normalized as ApprovalRequestStatus)
  ) {
    return normalized as ApprovalRequestStatus | "pending" | "completed" | "all";
  }

  return null;
}

function isSuperadminUser(user: AuthenticatedUser | undefined): user is AuthenticatedUser {
  return Boolean(user && user.role === "superadmin");
}

function canReadApprovalRequests(user: AuthenticatedUser) {
  return user.role === "superadmin" || user.permissions.includes("approvals:read");
}

function canCreateApprovalRequests(user: AuthenticatedUser) {
  return user.role === "superadmin" || user.permissions.includes("approvals:update");
}

function mapActorSummary(row: {
  id: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
}): ApprovalApproverSummary | null {
  if (!row.id || !row.fullName || !row.email || !row.role || !isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role,
  };
}

function mapRequestRow(row: RequestRow, progress: ApprovalProgress | null): ApprovalRequestView {
  const currentStep = progress?.steps.find((step) => step.isCurrent) ?? null;

  return {
    id: row.id,
    companyId: row.companyId,
    module: row.module,
    entityId: row.entityId,
    status: row.status as ApprovalRequestStatus,
    currentStep: row.currentStep,
    createdBy: mapActorSummary({
      id: row.createdById,
      fullName: row.createdByFullName,
      email: row.createdByEmail,
      role: row.createdByRole,
    }),
    currentApprover: currentStep?.approver ?? null,
    flow: {
      id: row.flowId,
      name: row.flowName,
      entityType: isApprovalEntityType(row.flowEntityType)
        ? row.flowEntityType
        : "leave",
      isActive: row.flowIsActive,
    },
    progress,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function loadProgressMap(
  companyId: string,
  requests: readonly RequestRow[],
) {
  const progressMap = new Map<string, ApprovalProgress>();
  const groupedByModule = new Map<string, RequestRow[]>();

  for (const request of requests) {
    const items = groupedByModule.get(request.module) ?? [];
    items.push(request);
    groupedByModule.set(request.module, items);
  }

  for (const [module, moduleRequests] of groupedByModule.entries()) {
    if (!isApprovalEntityType(module)) {
      continue;
    }

    const progress = await approvalsRepository.listEntityApprovalProgress(
      companyId,
      module,
      moduleRequests.map((request) => request.entityId),
    );

    for (const request of moduleRequests) {
      const requestProgress = progress.get(request.entityId) ?? null;

      if (requestProgress) {
        progressMap.set(request.id, requestProgress);
      }
    }
  }

  return progressMap;
}

async function loadRequestWorkspace(
  companyId: string,
  filters: ApprovalRequestListFilters = {},
  viewerUserId: string | null = null,
) {
  const pagination = normalizePagination(filters.page, filters.pageSize);
  const search = normalizeTextFilter(filters.search);
  const moduleFilter = normalizeTextFilter(filters.module);
  const status = normalizeStatusFilter(filters.status);
  const values: unknown[] = [companyId];
  const conditions = [`req.company_id = $1`];

  if (viewerUserId) {
    values.push(viewerUserId);
    const paramIndex = values.length;
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM approval_records AS assigned_records
        WHERE assigned_records.request_id = req.id
          AND assigned_records.approver_id = $${paramIndex}
      )`,
    );
  }

  if (status && status !== "all") {
    if (status === "pending") {
      conditions.push(`req.status IN ('pending', 'in_progress')`);
    } else if (status === "completed") {
      conditions.push(`req.status IN ('approved', 'rejected')`);
    } else {
      values.push(status);
      conditions.push(`req.status = $${values.length}`);
    }
  }

  if (moduleFilter) {
    values.push(moduleFilter);
    conditions.push(`LOWER(req.module) = LOWER($${values.length})`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    const paramIndex = values.length;
    conditions.push(
      `(
        LOWER(req.module) LIKE $${paramIndex}
        OR LOWER(req.entity_id) LIKE $${paramIndex}
        OR LOWER(req.status) LIKE $${paramIndex}
        OR LOWER(req.id) LIKE $${paramIndex}
        OR LOWER(COALESCE(creator.full_name, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(creator.email, '')) LIKE $${paramIndex}
      )`,
    );
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const summaryResult = await query<RequestSummaryRow>(
    `
      SELECT
        COUNT(*)::int AS "totalRequests",
        COUNT(*) FILTER (WHERE req.status = 'pending')::int AS "pendingRequests",
        COUNT(*) FILTER (WHERE req.status = 'in_progress')::int AS "inProgressRequests",
        COUNT(*) FILTER (WHERE req.status = 'approved')::int AS "approvedRequests",
        COUNT(*) FILTER (WHERE req.status = 'rejected')::int AS "rejectedRequests"
      FROM approval_requests AS req
      LEFT JOIN users AS creator
        ON creator.id = req.created_by
      ${whereClause}
    `,
    values,
  );

  const filteredCountResult = await query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM approval_requests AS req
      LEFT JOIN users AS creator
        ON creator.id = req.created_by
      ${whereClause}
    `,
    values,
  );

  const requestRowsResult = await query<RequestRow>(
    `
      SELECT
        req.id,
        req.company_id AS "companyId",
        req.flow_id AS "flowId",
        req.module,
        req.entity_id AS "entityId",
        req.status,
        req.current_step AS "currentStep",
        req.created_at AS "createdAt",
        req.updated_at AS "updatedAt",
        creator.id AS "createdById",
        creator.full_name AS "createdByFullName",
        creator.email AS "createdByEmail",
        creator.role AS "createdByRole",
        flow.name AS "flowName",
        flow.entity_type AS "flowEntityType",
        flow.is_active AS "flowIsActive"
      FROM approval_requests AS req
      LEFT JOIN users AS creator
        ON creator.id = req.created_by
      INNER JOIN approval_flows AS flow
        ON flow.id = req.flow_id
      ${whereClause}
      ORDER BY req.updated_at DESC, req.created_at DESC, req.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `,
    [...values, pagination.pageSize, pagination.offset],
  );
  const requestRows = requestRowsResult.rows;

  const progressMap = await loadProgressMap(companyId, requestRows);
  const requests = requestRows.map((row) => mapRequestRow(row, progressMap.get(row.id) ?? null));
  const totalItems = Number(filteredCountResult.rows[0]?.total ?? "0");

  return {
    summary: {
      ...(summaryResult.rows[0] ?? {
        totalRequests: 0,
        pendingRequests: 0,
        inProgressRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
      }),
      filteredRequests: totalItems,
    },
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / pagination.pageSize)),
      totalItems,
    },
    requests,
  };
}

async function loadRequestById(companyId: string, requestId: string) {
  const result = await query<RequestRow>(
    `
      SELECT
        req.id,
        req.company_id AS "companyId",
        req.flow_id AS "flowId",
        req.module,
        req.entity_id AS "entityId",
        req.status,
        req.current_step AS "currentStep",
        req.created_at AS "createdAt",
        req.updated_at AS "updatedAt",
        creator.id AS "createdById",
        creator.full_name AS "createdByFullName",
        creator.email AS "createdByEmail",
        creator.role AS "createdByRole",
        flow.name AS "flowName",
        flow.entity_type AS "flowEntityType",
        flow.is_active AS "flowIsActive"
      FROM approval_requests AS req
      LEFT JOIN users AS creator
        ON creator.id = req.created_by
      INNER JOIN approval_flows AS flow
        ON flow.id = req.flow_id
      WHERE req.company_id = $1
        AND req.id = $2
      LIMIT 1
    `,
    [companyId, requestId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const progressMap = await loadProgressMap(companyId, [row]);
  return mapRequestRow(row, progressMap.get(row.id) ?? null);
}

function canViewRequest(user: AuthenticatedUser, request: ApprovalRequestView) {
  if (user.role === "superadmin" || user.permissions.includes("approvals:read")) {
    return true;
  }

  if (request.createdBy?.id === user.id) {
    return true;
  }

  return request.currentApprover?.id === user.id;
}

function canActOnRequest(user: AuthenticatedUser, request: ApprovalRequestView) {
  return request.currentApprover?.id === user.id;
}

async function notifyAssignment(companyId: string, request: ApprovalRequestView) {
  const currentStep = resolveCurrentApprovalStep(request.progress);

  if (!currentStep?.approver) {
    return;
  }

  await notificationsService.notifyUser(companyId, currentStep.approver.id, {
    type: "approval.request.assigned",
    title: "Approval request awaiting your review",
    message: `${DEFAULT_APPROVAL_ENTITY_TYPE_LABELS[request.flow.entityType] ?? request.module} request ${request.entityId} is waiting on your ${currentStep.roleLabel.toLowerCase()} review.`,
    entityType: request.module,
    entityId: request.entityId,
  });
}

async function notifyCompletion(
  companyId: string,
  request: ApprovalRequestView,
  decision: "approved" | "rejected",
) {
  if (!request.createdBy) {
    return;
  }

  await notificationsService.notifyUser(companyId, request.createdBy.id, {
    type: decision === "approved" ? "approval.completed" : "approval.rejected",
    title:
      decision === "approved"
        ? "Approval request completed"
        : "Approval request rejected",
    message:
      decision === "approved"
        ? `${DEFAULT_APPROVAL_ENTITY_TYPE_LABELS[request.flow.entityType] ?? request.module} request ${request.entityId} was approved.`
        : `${DEFAULT_APPROVAL_ENTITY_TYPE_LABELS[request.flow.entityType] ?? request.module} request ${request.entityId} was rejected.`,
    entityType: request.module,
    entityId: request.entityId,
  });
}

export const approvalsExecutionService = {
  async getWorkspace(
    user: AuthenticatedUser,
    filters: ApprovalRequestListFilters = {},
  ): Promise<ApprovalServiceResult<ApprovalRequestListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canReadApprovalRequests(user)) {
      return fail(403, "You do not have permission to view approval requests.");
    }

    const [company, requestWorkspace] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      loadRequestWorkspace(user.companyId, filters),
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
      summary: requestWorkspace.summary,
      activeFilters: {
        status: normalizeStatusFilter(filters.status) ?? null,
        module: normalizeTextFilter(filters.module),
        search: normalizeTextFilter(filters.search),
      },
      pagination: requestWorkspace.pagination,
      requests: requestWorkspace.requests,
    });
  },

  async getMyApprovals(
    user: AuthenticatedUser,
    filters: ApprovalRequestListFilters = {},
  ): Promise<ApprovalServiceResult<ApprovalMyRequestsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, requestWorkspace] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      loadRequestWorkspace(user.companyId, filters, user.id),
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
      summary: requestWorkspace.summary,
      activeFilters: {
        status: normalizeStatusFilter(filters.status) ?? null,
        module: normalizeTextFilter(filters.module),
        search: normalizeTextFilter(filters.search),
      },
      pagination: requestWorkspace.pagination,
      requests: requestWorkspace.requests,
    });
  },

  async getRequestDetail(
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<
    ApprovalServiceResult<ApprovalRequestDetailResponse>
  > {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, request] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      loadRequestById(user.companyId, requestId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (!request) {
      return fail(404, "Approval request not found.");
    }

    if (!canViewRequest(user, request)) {
      return fail(403, "You do not have access to this approval request.");
    }

    return ok({
      request,
    });
  },

  async createRequest(
    user: AuthenticatedUser,
    input: CreateApprovalRequestPayload,
  ): Promise<
    ApprovalServiceResult<ApprovalRequestMutationResponse>
  > {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canCreateApprovalRequests(user)) {
      return fail(403, "You do not have permission to create approval requests.");
    }

    if (!isApprovalEntityType(input.module)) {
      return fail(400, "Unsupported approval module.");
    }

    const entityId = normalizeTextFilter(input.entityId);

    if (!entityId) {
      return fail(400, "An approval entity identifier is required.");
    }

    const flow = await approvalsRepository.findActiveApprovalFlow(
      user.companyId,
      input.module,
    );

    if (!flow) {
      return fail(404, "No active approval flow could be resolved for this module.");
    }

    let requestId: string | null = null;

    try {
      requestId = await withTransaction(async (client) =>
        approvalsRepository.createApprovalChainForEntity(
          client,
          input.module,
          entityId,
          flow,
          user.id,
        ),
      );
    } catch {
      return fail(409, "Unable to create the approval request.");
    }

    if (!requestId) {
      return fail(409, "Unable to resolve an approver for this approval request.");
    }

    const request = await loadRequestById(user.companyId, requestId);

    if (!request) {
      return fail(404, "Approval request not found.");
    }

    await notifyAssignment(user.companyId, request);

    void auditService.recordAction(user, {
      action: "approval_created",
      entityType: "approval_request",
      entityId: request.id,
      metadata: {
        module: request.module,
        entityId: request.entityId,
        flowId: request.flow.id,
        currentStep: request.currentStep,
      },
    });

    return ok({
      message: "Approval request created successfully.",
      request,
    });
  },

  async approveRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ApprovalDecisionPayload,
  ): Promise<
    ApprovalServiceResult<ApprovalRequestMutationResponse>
  > {
    return this.reviewRequest(user, requestId, {
      ...input,
      decision: "approved",
    });
  },

  async rejectRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ApprovalDecisionPayload,
  ): Promise<
    ApprovalServiceResult<ApprovalRequestMutationResponse>
  > {
    return this.reviewRequest(user, requestId, {
      ...input,
      decision: "rejected",
    });
  },

  async reviewRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ApprovalDecisionPayload & { decision: "approved" | "rejected" },
  ): Promise<
    ApprovalServiceResult<ApprovalRequestMutationResponse>
  > {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const detailResult = await this.getRequestDetail(user, requestId);

    if (!detailResult.ok) {
      return detailResult;
    }

    const request = detailResult.data.request;
    const currentStep = resolveCurrentApprovalStep(request.progress);

    if (!currentStep) {
      return fail(409, "This approval request does not have an active step.");
    }

    if (!canActOnRequest(user, request)) {
      return fail(409, "Only the assigned approver can act on this approval step.");
    }

    const transactionResult = await withTransaction(async (client) => {
      const decision = await approvalsRepository.recordApprovalDecision(client, {
        companyId: user.companyId as string,
        entityType: request.flow.entityType,
        entityId: request.entityId,
        stepId: currentStep.id,
        approverId: user.id,
        status: input.decision,
        remarks: input.remarks ?? null,
      });

      if (!decision) {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "This approval step could not be updated because it is no longer pending.",
        };
      }

      const updatedRequest = await loadRequestById(user.companyId as string, requestId);

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Approval request not found.",
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

    const updatedRequest = transactionResult.request;
    const updatedCurrentStep = resolveCurrentApprovalStep(updatedRequest.progress);

    if (updatedRequest.status === "approved" || updatedRequest.status === "rejected") {
      await notifyCompletion(user.companyId, updatedRequest, updatedRequest.status);
    } else if (updatedCurrentStep?.approver) {
      await notifyAssignment(user.companyId, updatedRequest);
    }

    void auditService.recordAction(user, {
      action:
        input.decision === "approved"
          ? updatedRequest.status === "approved"
            ? "approval_completed"
            : "approval_step_approved"
          : "approval_step_rejected",
      entityType: "approval_request",
      entityId: updatedRequest.id,
      metadata: {
        module: updatedRequest.module,
        entityId: updatedRequest.entityId,
        decision: input.decision,
        currentStep: updatedRequest.currentStep,
        nextStatus: updatedRequest.status,
        remarks: input.remarks ?? null,
      },
    });

    return ok({
      message:
        updatedRequest.status === "approved"
          ? "Approval request approved successfully."
          : updatedRequest.status === "rejected"
            ? "Approval request rejected successfully."
            : "Approval step recorded successfully.",
      request: updatedRequest,
    });
  },
};
