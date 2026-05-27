import type { ApprovalProgress } from "../approvals/approvals.types.js";
import type {
  AttendanceEmployeeSummary,
  AttendancePolicyContext,
  AttendanceRecord,
} from "../attendance/attendance.types.js";
import type { CompanyStatus } from "../companies/companies.types.js";

export const ATTENDANCE_CORRECTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export const ATTENDANCE_CORRECTION_REQUEST_TYPES = [
  "missed_check_in",
  "missed_check_out",
  "full_day_missing",
  "correction",
] as const;

export type AttendanceCorrectionStatus =
  (typeof ATTENDANCE_CORRECTION_STATUSES)[number];
export type AttendanceCorrectionRequestType =
  (typeof ATTENDANCE_CORRECTION_REQUEST_TYPES)[number];

export type AttendanceCorrectionRecord = {
  id: string;
  companyId: string;
  userId: string;
  attendanceId: string;
  attendanceDate: string;
  requestType: AttendanceCorrectionRequestType;
  employee: AttendanceEmployeeSummary;
  attendance: AttendanceRecord;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  approverId: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  approvalProgress: ApprovalProgress | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAttendanceCorrectionListResponse = {
  policy: AttendancePolicyContext;
  items: AttendanceCorrectionRecord[];
};

export type HrAttendanceCorrectionWorkspaceResponse = {
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
  };
  policy: AttendancePolicyContext;
  items: AttendanceCorrectionRecord[];
};

export type CreateAttendanceCorrectionRequest = {
  attendanceId?: string;
  attendanceDate: string;
  requestType: AttendanceCorrectionRequestType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
};

export type ReviewAttendanceCorrectionRequest = {
  status: "approved" | "rejected";
  rejectionReason?: string | null;
};

export type AttendanceCorrectionMutationResponse = {
  message: string;
  correction: AttendanceCorrectionRecord;
};

export type AttendanceCorrectionsServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AttendanceCorrectionsServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type AttendanceCorrectionsServiceResult<T> =
  | AttendanceCorrectionsServiceSuccess<T>
  | AttendanceCorrectionsServiceFailure;
