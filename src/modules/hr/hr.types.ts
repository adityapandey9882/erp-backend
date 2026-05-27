import type { CompanyStatus } from "../companies/companies.types.js";
import type { DepartmentView } from "../departments/departments.types.js";
import type { DesignationView } from "../designations/designations.types.js";
import type {
  HrProfileChangeRequestMutationResponse,
  HrProfileChangeRequestWorkspaceResponse,
  ReviewProfileChangeRequestRequest,
} from "../employee-self/employee-self.types.js";
import type {
  CompanyManagedUserRole,
  CompanyUserProfile,
  CompanyUserRoleSummary,
  UserAccountStatus,
  UpdateCompanyUserOrganizationProfileRequest,
} from "../users/users.types.js";

export type HrEmployeeProfile = CompanyUserProfile;

export type HrDashboardTone =
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "violet"
  | "cyan"
  | "slate";

export type HrDashboardStatCardKey =
  | "total-employees"
  | "present-today"
  | "absent-today"
  | "late-marks"
  | "pending-leave"
  | "new-joiners"
  | "notice-period"
  | "attendance-not-submitted";

export type HrDashboardStatCard = {
  key: HrDashboardStatCardKey;
  label: string;
  value: number;
  description: string;
  actionLabel: string;
  href: string;
  tone: HrDashboardTone;
};

export type HrDashboardAttendanceSegment = {
  key: "present" | "absent" | "late" | "on-leave" | "not-submitted";
  label: string;
  value: number;
  tone: HrDashboardTone;
};

export type HrDashboardShiftAttendanceItem = {
  id: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  total: number;
};

export type HrDashboardMissingPunchItem = {
  id: string;
  userId: string;
  employeeName: string;
  employeeRole: string;
  profilePhotoUrl: string | null;
  issue: "check-in-missing" | "check-out-missing";
  issueLabel: string;
  timeLabel: string;
};

export type HrDashboardAlertItem = {
  id: string;
  title: string;
  message: string;
  tone: HrDashboardTone;
  href: string;
};

export type HrDashboardPendingLeaveItem = {
  id: string;
  employeeName: string;
  profilePhotoUrl: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
};

export type HrDashboardLeaveTodayItem = {
  id: string;
  employeeName: string;
  profilePhotoUrl: string | null;
  departmentName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
};

export type HrDashboardCalendarMarker = {
  date: string;
  kind: "approved-leave" | "pending-leave" | "holiday";
  count: number;
};

export type HrDashboardLeaveBalanceAlert = {
  id: string;
  label: string;
  count: number;
  description: string;
};

export type HrDashboardRecentJoiner = {
  userId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  departmentName: string | null;
  createdAt: string;
};

export type HrDashboardReadinessItem = {
  id: string;
  label: string;
  value: number;
  description: string;
  tone: HrDashboardTone;
};

export type HrDashboardNotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  status: "unread" | "read";
};

export type HrDashboardHighlightCard = {
  key:
    | "office-holiday"
    | "policy-update"
    | "payroll-update"
    | "announcement-update";
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: HrDashboardTone;
};

export type HrDashboardOverview = {
  meta: {
    currentDate: string;
    currentMonthLabel: string;
    payrollCycleLabel: string;
    attendanceStatusLabel: string;
    attendanceStatusTone: HrDashboardTone;
  };
  statCards: HrDashboardStatCard[];
  attendanceSummary: {
    totalEmployees: number;
    segments: HrDashboardAttendanceSegment[];
  };
  shiftAttendance: {
    items: HrDashboardShiftAttendanceItem[];
  };
  missingPunches: {
    items: HrDashboardMissingPunchItem[];
  };
  alerts: {
    items: HrDashboardAlertItem[];
  };
  pendingLeaveRequests: {
    total: number;
    items: HrDashboardPendingLeaveItem[];
  };
  employeesOnLeaveToday: {
    total: number;
    items: HrDashboardLeaveTodayItem[];
  };
  leaveCalendar: {
    currentDate: string;
    markers: HrDashboardCalendarMarker[];
  };
  leaveBalanceAlerts: {
    items: HrDashboardLeaveBalanceAlert[];
  };
  lifecycle: {
    newJoinersThisMonth: number;
    onboardingInProgress: number;
    probationEmployees: number;
    noticePeriodEmployees: number;
    exitsThisMonth: number;
    recentJoiners: HrDashboardRecentJoiner[];
  };
  payrollReadiness: {
    readinessPercent: number;
    readyEmployees: number;
    totalEmployees: number;
    items: HrDashboardReadinessItem[];
  };
  notifications: {
    unreadCount: number;
    items: HrDashboardNotificationItem[];
  };
  highlights: {
    items: HrDashboardHighlightCard[];
  };
};

export type HrOverviewResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    mappedDepartments: number;
    mappedDesignations: number;
    rolesInUse: number;
  };
  roleDistribution: CompanyUserRoleSummary[];
  organization: {
    departments: DepartmentView[];
    designations: DesignationView[];
  };
  dashboard: HrDashboardOverview;
};

export type HrEmployeeDirectoryResponse = {
  items: HrEmployeeProfile[];
};

export type HrEmployeeDetailResponse = {
  employee: HrEmployeeProfile;
};

export type UpdateHrEmployeeProfileRequest =
  UpdateCompanyUserOrganizationProfileRequest;

export type HrEmployeeMutationResponse = {
  message: string;
  employee: HrEmployeeProfile;
};

export type ImportHrEmployeeRowRequest = {
  rowNumber: number;
  fullName: string;
  email: string;
  password: string;
  role: string;
  status: string;
};

export type ImportHrEmployeeRow = {
  rowNumber: number;
  fullName: string;
  email: string;
  password: string;
  role: CompanyManagedUserRole;
  status: UserAccountStatus;
};

export type ImportHrEmployeesRequest = {
  rows: ImportHrEmployeeRowRequest[];
};

export type HrEmployeeImportFailure = {
  rowNumber: number;
  fullName: string;
  email: string;
  message: string;
};

export type HrEmployeeImportResponse = {
  message: string;
  importedCount: number;
  failedCount: number;
  employees: HrEmployeeProfile[];
  failures: HrEmployeeImportFailure[];
};

export type HrProfileChangeRequestDetailResponse =
  HrProfileChangeRequestWorkspaceResponse;

export type ReviewHrProfileChangeRequestRequest =
  ReviewProfileChangeRequestRequest;

export type HrProfileChangeRequestReviewResponse =
  HrProfileChangeRequestMutationResponse;

export type HrServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type HrServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type HrServiceResult<T> = HrServiceSuccess<T> | HrServiceFailure;
