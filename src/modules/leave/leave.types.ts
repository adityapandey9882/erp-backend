import type { CompanyStatus } from "../companies/companies.types.js";
import type { ApprovalProgress } from "../approvals/approvals.types.js";
import type { CompanyUserProfile } from "../users/users.types.js";

export const LEAVE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export const HR_REVIEWABLE_LEAVE_STATUSES = ["approved", "rejected"] as const;
export const MANAGER_LEAVE_REVIEW_STATUSES = [
  "pending",
  "approved",
  "forwarded",
  "rejected",
] as const;
export const MANAGER_REVIEW_ACTIONS = [
  "approved",
  "forwarded",
  "rejected",
] as const;

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];
export type HrReviewableLeaveStatus =
  (typeof HR_REVIEWABLE_LEAVE_STATUSES)[number];
export type ManagerLeaveReviewStatus =
  (typeof MANAGER_LEAVE_REVIEW_STATUSES)[number];
export type ManagerReviewAction = (typeof MANAGER_REVIEW_ACTIONS)[number];

export type LeavePolicyUsage = {
  cycleStartDate: string;
  cycleEndDate: string;
  usedDays: number;
  remainingDays: number;
};

export type LeavePolicyContext = {
  maxDaysPerYear: number;
  allowHalfDay: boolean;
  halfDaySupported: boolean;
  requireApproval: boolean;
  approvalRequiredByWorkflow: boolean;
  leaveResetCycle: string;
  employeeUsage: LeavePolicyUsage | null;
  enforcementNotes: string[];
};

export type LeaveManagerReviewer = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role"
>;

export type LeaveManagerReview = {
  status: ManagerLeaveReviewStatus;
  reviewedAt: string | null;
  reviewedBy: LeaveManagerReviewer | null;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  leaveType: string;
  reason: string;
  status: LeaveRequestStatus;
  managerReview: LeaveManagerReview;
  approvalProgress?: ApprovalProgress | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveEmployeeSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role" | "status" | "department" | "designation"
> & {
  employeeId?: string | null;
  workLocation?: string | null;
  profilePhotoUrl?: string | null;
};

export type HrLeaveEntry = LeaveRequest & {
  employee: LeaveEmployeeSummary;
};

export type HrLeaveWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    employeesWithRequests: number;
  };
  policy: LeavePolicyContext;
  items: HrLeaveEntry[];
};

export type EmployeeLeaveWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  profile: LeaveEmployeeSummary;
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  };
  policy: LeavePolicyContext;
  items: LeaveRequest[];
};

export type CreateEmployeeLeaveRequest = {
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
};

export type UpdateHrLeaveStatusRequest = {
  status: HrReviewableLeaveStatus;
  remarks?: string | null;
};

export type UpdateManagerLeaveStatusRequest = {
  status: ManagerReviewAction;
};

export type EmployeeLeaveMutationResponse = {
  message: string;
  request: LeaveRequest;
};

export type HrLeaveMutationResponse = {
  message: string;
  request: HrLeaveEntry;
};

export type LeaveServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type LeaveServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type LeaveServiceResult<T> = LeaveServiceSuccess<T> | LeaveServiceFailure;

export function isLeaveRequestStatus(value: string): value is LeaveRequestStatus {
  return LEAVE_REQUEST_STATUSES.includes(value as LeaveRequestStatus);
}

export function isHrReviewableLeaveStatus(
  value: string,
): value is HrReviewableLeaveStatus {
  return HR_REVIEWABLE_LEAVE_STATUSES.includes(value as HrReviewableLeaveStatus);
}

export function isManagerLeaveReviewStatus(
  value: string,
): value is ManagerLeaveReviewStatus {
  return MANAGER_LEAVE_REVIEW_STATUSES.includes(
    value as ManagerLeaveReviewStatus,
  );
}

export function isManagerReviewAction(value: string): value is ManagerReviewAction {
  return MANAGER_REVIEW_ACTIONS.includes(value as ManagerReviewAction);
}
