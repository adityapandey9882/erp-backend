import type { ApprovalProgress } from "../approvals/approvals.types.js";
import type { CompanyStatus } from "../companies/companies.types.js";
import type { DepartmentView } from "../departments/departments.types.js";
import type { DesignationView } from "../designations/designations.types.js";
import type { EmployeeProfileEmploymentType } from "../employee-self/employee-self.types.js";
import type { AppRole } from "../roles/roles.types.js";
import type {
  CompanyUserDepartmentSummary,
  CompanyUserDesignationSummary,
  UserAccountStatus,
} from "../users/users.types.js";

export const ONBOARDING_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "completed",
] as const;

export type OnboardingRequestStatus =
  (typeof ONBOARDING_REQUEST_STATUSES)[number];

export type OnboardingEmployeeSummary = {
  id: string;
  fullName: string;
  email: string;
  personalEmail: string | null;
  phone: string | null;
  employeeId: string | null;
  role: AppRole;
  status: UserAccountStatus;
  employmentType: EmployeeProfileEmploymentType | null;
  reportingManager: OnboardingActorSummary | null;
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
};

export type OnboardingActorSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type OnboardingRequestRecord = {
  id: string;
  companyId: string;
  userId: string;
  employee: OnboardingEmployeeSummary;
  status: OnboardingRequestStatus;
  documentCount: number;
  approvalProgress: ApprovalProgress | null;
  joiningDate: string | null;
  assignedHr: OnboardingActorSummary | null;
  checklist: OnboardingChecklistSummary;
  documentOverview: OnboardingDocumentOverview;
  nextActions: OnboardingNextAction[];
  verificationStatus: OnboardingVerificationStatus;
  assignedAssetsCount: number;
  hasBankDetails: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingChecklistStatus = "completed" | "in-progress" | "pending";

export type OnboardingChecklistItem = {
  key:
    | "offer-letter"
    | "offer-accepted"
    | "personal-details"
    | "documents-uploaded"
    | "documents-verified"
    | "employee-id"
    | "official-email"
    | "asset-assigned"
    | "training-scheduled"
    | "bank-details"
    | "payroll-setup"
    | "welcome-kit"
    | "joining-completed";
  label: string;
  status: OnboardingChecklistStatus;
  helper: string;
};

export type OnboardingChecklistSummary = {
  items: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
};

export type OnboardingDocumentOverview = {
  required: number;
  uploaded: number;
  verified: number;
  rejected: number;
  pending: number;
};

export type OnboardingNextActionTone = "neutral" | "warning" | "success";

export type OnboardingNextAction = {
  id: string;
  label: string;
  description: string;
  tone: OnboardingNextActionTone;
};

export type OnboardingVerificationStatus =
  | "document-pending"
  | "verification-pending"
  | "ready-to-join"
  | "completed"
  | "rejected";

export type OnboardingWorkspaceResponse = {
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
    newJoinersThisMonth: number;
    pendingDocuments: number;
    verificationPending: number;
    readyToJoin: number;
    completedThisMonth: number;
  };
  organization: {
    departments: DepartmentView[];
    designations: DesignationView[];
    managers: OnboardingActorSummary[];
  };
  activeFilters: {
    userId: string | null;
    status: OnboardingRequestStatus | null;
  };
  availableUsers: OnboardingEmployeeSummary[];
  requests: OnboardingRequestRecord[];
};

export type CreateOnboardingRequest = {
  userId: string;
  personalEmail: string;
  phone: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
  joiningDate: string;
  employmentType: EmployeeProfileEmploymentType;
};

export type ReviewOnboardingRequest = {
  status: "approved" | "rejected";
};

export type UpdateOnboardingRequestDetails = {
  personalEmail?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  reportingManagerId?: string | null;
  joiningDate?: string | null;
  employmentType?: EmployeeProfileEmploymentType | null;
};

export type TriggerOnboardingRequestAction = {
  action: "send-reminder" | "send-upload-link" | "request-document";
};

export type OnboardingMutationResponse = {
  message: string;
  request: OnboardingRequestRecord;
};

export type OnboardingServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type OnboardingServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type OnboardingServiceResult<T> =
  | OnboardingServiceSuccess<T>
  | OnboardingServiceFailure;
