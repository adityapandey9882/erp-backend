import type { CompanyStatus } from "../companies/companies.types.js";
import type { AppRole } from "../roles/roles.types.js";

export const APPROVAL_ENTITY_TYPES = [
  "leave",
  "onboarding",
  "offboarding",
  "attendance-correction",
] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

export const APPROVAL_STEP_ROLES = [
  "manager",
  "admin",
  "hr",
  "accounts",
  "project-manager",
  "team-lead",
  "employee",
] as const;

export type ApprovalStepRole = (typeof APPROVAL_STEP_ROLES)[number];

export const APPROVAL_ROLE_LABELS: Record<ApprovalStepRole, string> = {
  manager: "Manager",
  admin: "Company Admin",
  hr: "HR",
  accounts: "Accounts",
  "project-manager": "Project Manager",
  "team-lead": "Team Lead",
  employee: "Employee",
};

export const APPROVAL_ROLE_DESCRIPTIONS: Record<ApprovalStepRole, string> = {
  manager: "Department-scoped manager review handled by the manager workspace.",
  admin: "Company administration review handled by the company admin workspace.",
  hr: "People-operations review handled by the HR workspace.",
  accounts: "Finance review handled by the accounts workspace.",
  "project-manager":
    "Project manager review handled by the project-manager workspace.",
  "team-lead": "Team lead review handled by the team-lead workspace.",
  employee: "Self-service review handled by the employee workspace.",
};

export const DEFAULT_APPROVAL_ENTITY_TYPE_LABELS: Record<ApprovalEntityType, string> =
  {
    leave: "Leave",
    onboarding: "Onboarding",
    offboarding: "Offboarding",
    "attendance-correction": "Attendance Correction",
  };

export type ApprovalRoleOption = {
  value: ApprovalStepRole;
  label: string;
  description: string;
};

export type ApprovalApproverSummary = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
};

export type ApprovalFlowStepSummary = {
  id: string;
  flowId: string;
  stepOrder: number;
  role: ApprovalStepRole;
  roleLabel: string;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalFlowSummary = {
  id: string;
  companyId: string;
  entityType: ApprovalEntityType;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: ApprovalFlowStepSummary[];
};

export type ApprovalProgressStep = {
  id: string;
  stepOrder: number;
  role: ApprovalStepRole;
  roleLabel: string;
  isRequired: boolean;
  status: "pending" | "approved" | "rejected";
  isCurrent: boolean;
  isLocked: boolean;
  approver: ApprovalApproverSummary | null;
  actedAt: string | null;
  remarks: string | null;
};

export type ApprovalProgress = {
  entityType: ApprovalEntityType;
  entityId: string;
  flow: {
    id: string;
    name: string;
    entityType: ApprovalEntityType;
    isActive: boolean;
  };
  status: "pending" | "approved" | "rejected";
  totalSteps: number;
  completedSteps: number;
  currentStepOrder: number | null;
  steps: ApprovalProgressStep[];
};

export const APPROVAL_REQUEST_STATUSES = [
  "pending",
  "in_progress",
  "approved",
  "rejected",
] as const;

export type ApprovalRequestStatus =
  (typeof APPROVAL_REQUEST_STATUSES)[number];

export type ApprovalRequestView = {
  id: string;
  companyId: string;
  module: string;
  entityId: string;
  status: ApprovalRequestStatus;
  currentStep: number;
  createdBy: ApprovalApproverSummary | null;
  currentApprover: ApprovalApproverSummary | null;
  flow: {
    id: string;
    name: string;
    entityType: ApprovalEntityType;
    isActive: boolean;
  };
  progress: ApprovalProgress | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRequestStatusFilter =
  | ApprovalRequestStatus
  | "pending"
  | "completed"
  | "all";

export type ApprovalRequestListFilters = {
  status?: ApprovalRequestStatusFilter | null;
  module?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
};

export type ApprovalRequestListResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalRequests: number;
    pendingRequests: number;
    inProgressRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    filteredRequests: number;
  };
  activeFilters: {
    status: ApprovalRequestStatusFilter | null;
    module: string | null;
    search: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  requests: ApprovalRequestView[];
};

export type ApprovalMyRequestsResponse = ApprovalRequestListResponse;

export type ApprovalRequestDetailResponse = {
  request: ApprovalRequestView;
};

export type CreateApprovalRequestPayload = {
  module: ApprovalEntityType;
  entityId: string;
};

export type ApprovalDecisionPayload = {
  remarks?: string | null;
};

export type ApprovalRequestMutationResponse = {
  message: string;
  request: ApprovalRequestView;
};

export type ApprovalEntityTypeOption = {
  value: ApprovalEntityType;
  label: string;
  description: string;
};

export type ApprovalWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalFlows: number;
    activeFlows: number;
    archivedFlows: number;
    totalSteps: number;
  };
  entityTypes: ApprovalEntityTypeOption[];
  roleOptions: ApprovalRoleOption[];
  flows: ApprovalFlowSummary[];
};

export type CreateApprovalFlowRequest = {
  entityType: ApprovalEntityType;
  name: string;
  steps: {
    role: ApprovalStepRole;
    isRequired: boolean;
  }[];
};

export type UpdateApprovalFlowRequest = CreateApprovalFlowRequest;

export type ApprovalFlowMutationResponse = {
  message: string;
  flow: ApprovalFlowSummary;
};

export type ApprovalServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type ApprovalServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type ApprovalServiceResult<T> =
  | ApprovalServiceSuccess<T>
  | ApprovalServiceFailure;

export function isApprovalStepRole(value: string): value is ApprovalStepRole {
  return APPROVAL_STEP_ROLES.includes(value as ApprovalStepRole);
}

export function isApprovalEntityType(
  value: string,
): value is ApprovalEntityType {
  return APPROVAL_ENTITY_TYPES.includes(value as ApprovalEntityType);
}
