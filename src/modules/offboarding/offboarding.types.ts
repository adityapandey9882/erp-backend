import type { ApprovalProgress } from "../approvals/approvals.types.js";
import type { CompanyStatus } from "../companies/companies.types.js";
import type { DepartmentView } from "../departments/departments.types.js";
import type { DesignationView } from "../designations/designations.types.js";
import type { AppRole } from "../roles/roles.types.js";
import type {
  CompanyUserDepartmentSummary,
  CompanyUserDesignationSummary,
  CompanyUserManagerSummary,
  UserAccountStatus,
} from "../users/users.types.js";

export const OFFBOARDING_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "completed",
] as const;

export const OFFBOARDING_EXIT_TYPES = [
  "resignation",
  "termination",
  "retirement",
  "contract-end",
  "mutual-separation",
] as const;

export const OFFBOARDING_WORKFLOW_STAGES = [
  "notice-period",
  "clearance-pending",
  "settlement-pending",
  "ready-to-exit",
  "completed",
  "rejected",
] as const;

export type OffboardingRequestStatus =
  (typeof OFFBOARDING_REQUEST_STATUSES)[number];
export type OffboardingExitType = (typeof OFFBOARDING_EXIT_TYPES)[number];
export type OffboardingWorkflowStage =
  (typeof OFFBOARDING_WORKFLOW_STAGES)[number];

export type OffboardingEmployeeSummary = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  role: AppRole;
  status: UserAccountStatus;
  reportingManager: CompanyUserManagerSummary | null;
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
};

export type OffboardingActorSummary = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
};

export type OffboardingChecklistStatus = "completed" | "in-progress" | "pending";

export type OffboardingChecklistItem = {
  key:
    | "resignation-received"
    | "manager-approved"
    | "notice-period-served"
    | "knowledge-transfer"
    | "asset-return"
    | "access-revocation"
    | "exit-documents"
    | "exit-interview"
    | "final-settlement"
    | "offboarding-completed";
  label: string;
  status: OffboardingChecklistStatus;
  helper: string;
};

export type OffboardingChecklistSummary = {
  items: OffboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
};

export type OffboardingClearanceSummary = {
  expectedAssetCount: number;
  returnedAssetCount: number;
  pendingAssetCount: number;
  knowledgeTransferPercent: number;
  pendingApprovals: number;
  revokedAccessCount: number;
  totalAccessCount: number;
  exitInterviewScheduledAt: string | null;
  exitInterviewCompleted: boolean;
  finalSettlementStatus: "pending" | "ready" | "completed";
  finalSettlementAmount: number | null;
  documentsReadyCount: number;
  documentsPendingCount: number;
};

export type OffboardingRequestRecord = {
  id: string;
  companyId: string;
  userId: string;
  employee: OffboardingEmployeeSummary;
  status: OffboardingRequestStatus;
  initiatedBy: OffboardingActorSummary | null;
  completedBy: OffboardingActorSummary | null;
  completedAt: string | null;
  assignedHr: OffboardingActorSummary | null;
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
  reportingManager: CompanyUserManagerSummary | null;
  exitType: OffboardingExitType;
  resignationDate: string | null;
  lastWorkingDate: string | null;
  noticePeriodDays: number | null;
  reason: string | null;
  expectedAssetCount: number;
  requestedDocumentCount: number;
  exitInterviewScheduledAt: string | null;
  finalSettlementAmount: number | null;
  assignedAssetCount: number;
  documentCount: number;
  approvalProgress: ApprovalProgress | null;
  workflowStage: OffboardingWorkflowStage;
  checklist: OffboardingChecklistSummary;
  clearance: OffboardingClearanceSummary;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type OffboardingWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    completedRequests: number;
    readyToCompleteRequests: number;
    assetsPendingReturn: number;
    documentsTracked: number;
    activeRequests: number;
    noticePeriodRequests: number;
    clearancePendingRequests: number;
    finalSettlementPendingRequests: number;
    completedThisMonth: number;
  };
  organization: {
    departments: DepartmentView[];
    designations: DesignationView[];
    managers: OffboardingActorSummary[];
  };
  activeFilters: {
    userId: string | null;
    status: OffboardingRequestStatus | null;
  };
  availableUsers: OffboardingEmployeeSummary[];
  requests: OffboardingRequestRecord[];
};

export type CreateOffboardingRequest = {
  userId: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
  exitType: OffboardingExitType;
  resignationDate: string;
  lastWorkingDate: string;
  noticePeriodDays: number;
  reason?: string | null;
};

export type UpdateOffboardingRequestDetails = {
  departmentId?: string | null;
  designationId?: string | null;
  reportingManagerId?: string | null;
  exitType?: OffboardingExitType | null;
  resignationDate?: string | null;
  lastWorkingDate?: string | null;
  noticePeriodDays?: number | null;
  reason?: string | null;
};

export type ReviewOffboardingRequest = {
  status: "approved" | "rejected";
};

export type TriggerOffboardingRequestAction = {
  action: "send-reminder" | "generate-letters";
};

export type OffboardingMutationResponse = {
  message: string;
  request: OffboardingRequestRecord;
};

export type OffboardingServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type OffboardingServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type OffboardingServiceResult<T> =
  | OffboardingServiceSuccess<T>
  | OffboardingServiceFailure;
