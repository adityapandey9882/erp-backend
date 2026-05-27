import type {
  HrAttendanceCorrectionWorkspaceResponse,
} from "../attendance-corrections/attendance-corrections.types.js";
import type { HrAttendanceWorkspaceResponse } from "../attendance/attendance.types.js";
import type {
  AdminAttendanceSettingsView,
  AdminBiometricDeviceView,
  AdminPayrollSettingsView,
} from "../admin/admin-settings.types.js";
import type { HolidayCalendarItem } from "../admin/admin-holiday-calendar.types.js";
import type { AnnouncementManagementWorkspaceResponse } from "../announcements/announcements.types.js";
import type { HrLeaveWorkspaceResponse } from "../leave/leave.types.js";
import type { NotificationsWorkspaceResponse } from "../notifications/notifications.types.js";
import type { OffboardingWorkspaceResponse } from "../offboarding/offboarding.types.js";
import type { OnboardingWorkspaceResponse } from "../onboarding/onboarding.types.js";
import type { PayrollOverviewResponse } from "../payroll/payroll.types.js";
import type { HrShiftWorkspaceResponse } from "../shifts/shifts.types.js";
import type {
  HrDashboardAlertItem,
  HrDashboardAttendanceSegment,
  HrDashboardCalendarMarker,
  HrDashboardHighlightCard,
  HrDashboardLeaveBalanceAlert,
  HrDashboardLeaveTodayItem,
  HrDashboardMissingPunchItem,
  HrDashboardNotificationItem,
  HrDashboardOverview,
  HrDashboardPendingLeaveItem,
  HrDashboardReadinessItem,
  HrDashboardRecentJoiner,
  HrDashboardShiftAttendanceItem,
  HrDashboardStatCard,
  HrDashboardTone,
  HrEmployeeProfile,
} from "./hr.types.js";

const MS_PER_DAY = 86400000;
const PROBATION_WINDOW_DAYS = 90;

type DashboardBuilderInput = {
  employees: HrEmployeeProfile[];
  currentDate: string;
  attendanceWorkspace: HrAttendanceWorkspaceResponse;
  leaveWorkspace: HrLeaveWorkspaceResponse;
  shiftsWorkspace: HrShiftWorkspaceResponse;
  onboardingWorkspace: OnboardingWorkspaceResponse;
  offboardingWorkspace: OffboardingWorkspaceResponse;
  payrollOverview: PayrollOverviewResponse;
  notificationsWorkspace: NotificationsWorkspaceResponse;
  announcementsWorkspace: AnnouncementManagementWorkspaceResponse;
  attendanceCorrectionsWorkspace: HrAttendanceCorrectionWorkspaceResponse;
  attendanceSettings: AdminAttendanceSettingsView;
  payrollSettings: AdminPayrollSettingsView;
  biometricDevices: AdminBiometricDeviceView[];
  holidays: HolidayCalendarItem[];
};

type DateWindow = {
  startDate: string;
  endDate: string;
};

function parseDateOnlyMs(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateOnlyMs(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(dateMs: number, days: number) {
  return dateMs + days * MS_PER_DAY;
}

function isDateWithinRange(date: string, startDate: string, endDate: string) {
  const currentMs = parseDateOnlyMs(date);

  return (
    currentMs >= parseDateOnlyMs(startDate) &&
    currentMs <= parseDateOnlyMs(endDate)
  );
}

function isSameMonth(left: string, right: string) {
  return left.slice(0, 7) === right.slice(0, 7);
}

function getMonthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function getMonthEnd(value: string) {
  const [year = 0, month = 1] = value.slice(0, 7).split("-").map(Number);
  return formatDateOnlyMs(Date.UTC(year, month, 0));
}

function buildMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function toPercentLabel(value: number, total: number) {
  if (total <= 0) {
    return "0.00%";
  }

  return `${((value / total) * 100).toFixed(2)}%`;
}

function toTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function countInclusiveDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.floor((parseDateOnlyMs(endDate) - parseDateOnlyMs(startDate)) / MS_PER_DAY) + 1,
  );
}

function calculateOverlapDays(
  startDate: string,
  endDate: string,
  window: DateWindow,
) {
  const overlapStart = Math.max(
    parseDateOnlyMs(startDate),
    parseDateOnlyMs(window.startDate),
  );
  const overlapEnd = Math.min(
    parseDateOnlyMs(endDate),
    parseDateOnlyMs(window.endDate),
  );

  if (overlapEnd < overlapStart) {
    return 0;
  }

  return Math.floor((overlapEnd - overlapStart) / MS_PER_DAY) + 1;
}

function resolveLeaveUsageWindow(
  leaveResetCycle: string,
  referenceDate: string,
): DateWindow {
  if (leaveResetCycle === "rolling-12-months") {
    const endMs = parseDateOnlyMs(referenceDate);

    return {
      startDate: formatDateOnlyMs(addDays(endMs, -364)),
      endDate: referenceDate,
    };
  }

  const [year = 0] = referenceDate.split("-").map(Number);

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function formatLeaveResetCycle(value: string) {
  return value === "rolling-12-months" ? "Rolling 12 months" : "Calendar year";
}

function formatPayrollCycle(value: string) {
  if (value === "semi-monthly") {
    return "Semi-monthly";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveAttendanceStatus(
  attendanceWorkspace: HrAttendanceWorkspaceResponse,
): {
  label: string;
  tone: HrDashboardTone;
} {
  if (attendanceWorkspace.summary.openSessions > 0) {
    return {
      label: "Open",
      tone: "emerald",
    };
  }

  if (attendanceWorkspace.summary.recordsToday > 0) {
    return {
      label: "In Sync",
      tone: "blue",
    };
  }

  return {
    label: "Pending",
    tone: "amber",
  };
}

function getCurrentClockMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function toClockMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatClockLabel(value: string) {
  const [hours = "00", minutes = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getWorkforce(employees: readonly HrEmployeeProfile[]) {
  return employees.filter((employee) => employee.role !== "admin");
}

function getActiveWorkforce(employees: readonly HrEmployeeProfile[]) {
  return getWorkforce(employees).filter((employee) => employee.status === "active");
}

function buildShiftLookup(workspace: HrShiftWorkspaceResponse) {
  return new Map(
    workspace.assignments.map((assignment) => [assignment.userId, assignment.shift]),
  );
}

function buildTodayAttendanceLookup(
  workspace: HrAttendanceWorkspaceResponse,
  currentDate: string,
) {
  return new Map(
    workspace.items
      .filter((item) => item.attendanceDate === currentDate)
      .map((item) => [item.userId, item]),
  );
}

function buildLeaveLookup(
  workspace: HrLeaveWorkspaceResponse,
  currentDate: string,
  status: "approved" | "pending",
) {
  return new Map(
    workspace.items
      .filter(
        (item) =>
          item.status === status &&
          isDateWithinRange(currentDate, item.startDate, item.endDate),
      )
      .map((item) => [item.userId, item]),
  );
}

function buildEmployeeLeaveRequestLookup(workspace: HrLeaveWorkspaceResponse) {
  const map = new Map<string, HrLeaveWorkspaceResponse["items"]>();

  for (const item of workspace.items) {
    const current = map.get(item.userId);

    if (current) {
      current.push(item);
      continue;
    }

    map.set(item.userId, [item]);
  }

  return map;
}

function hasAttendanceMarkedLate(
  item: HrAttendanceWorkspaceResponse["items"][number],
) {
  return item.policyEvaluation?.lateStatus === "late";
}

function hasShiftStarted(
  employee: HrEmployeeProfile,
  shiftLookup: Map<string, HrShiftWorkspaceResponse["assignments"][number]["shift"]>,
  attendanceSettings: AdminAttendanceSettingsView,
  currentClockMinutes: number,
) {
  const shift = shiftLookup.get(employee.id);
  const shiftStart = shift?.startTime ?? attendanceSettings.defaultShiftStart;
  const thresholdMinutes =
    toClockMinutes(shiftStart) + Math.max(0, attendanceSettings.graceTimeMinutes);

  return currentClockMinutes >= thresholdMinutes;
}

function buildAttendanceClassification(
  employees: readonly HrEmployeeProfile[],
  currentDate: string,
  attendanceWorkspace: HrAttendanceWorkspaceResponse,
  leaveWorkspace: HrLeaveWorkspaceResponse,
  shiftsWorkspace: HrShiftWorkspaceResponse,
  attendanceSettings: AdminAttendanceSettingsView,
) {
  const activeWorkforce = getActiveWorkforce(employees);
  const shiftLookup = buildShiftLookup(shiftsWorkspace);
  const todayAttendanceLookup = buildTodayAttendanceLookup(
    attendanceWorkspace,
    currentDate,
  );
  const approvedLeaveLookup = buildLeaveLookup(
    leaveWorkspace,
    currentDate,
    "approved",
  );
  const currentClockMinutes = getCurrentClockMinutes();

  const presentIds = new Set<string>();
  const lateIds = new Set<string>();
  const onLeaveIds = new Set<string>();
  const absentIds = new Set<string>();
  const pendingSubmissionIds = new Set<string>();

  for (const employee of activeWorkforce) {
    if (approvedLeaveLookup.has(employee.id)) {
      onLeaveIds.add(employee.id);
      continue;
    }

    const attendance = todayAttendanceLookup.get(employee.id);

    if (attendance) {
      if (hasAttendanceMarkedLate(attendance)) {
        lateIds.add(employee.id);
      } else {
        presentIds.add(employee.id);
      }
      continue;
    }

    if (
      hasShiftStarted(
        employee,
        shiftLookup,
        attendanceSettings,
        currentClockMinutes,
      )
    ) {
      absentIds.add(employee.id);
      continue;
    }

    pendingSubmissionIds.add(employee.id);
  }

  return {
    activeWorkforce,
    shiftLookup,
    todayAttendanceLookup,
    approvedLeaveLookup,
    presentIds,
    lateIds,
    onLeaveIds,
    absentIds,
    pendingSubmissionIds,
  };
}

function buildAttendanceSegments(
  classification: ReturnType<typeof buildAttendanceClassification>,
): HrDashboardAttendanceSegment[] {
  return [
    {
      key: "present",
      label: "Present",
      value: classification.presentIds.size,
      tone: "emerald",
    },
    {
      key: "absent",
      label: "Absent",
      value: classification.absentIds.size,
      tone: "rose",
    },
    {
      key: "late",
      label: "Late",
      value: classification.lateIds.size,
      tone: "amber",
    },
    {
      key: "on-leave",
      label: "On Leave",
      value: classification.onLeaveIds.size,
      tone: "violet",
    },
    {
      key: "not-submitted",
      label: "Attendance Pending",
      value: classification.pendingSubmissionIds.size,
      tone: "slate",
    },
  ];
}

function buildStatCards(
  employees: readonly HrEmployeeProfile[],
  classification: ReturnType<typeof buildAttendanceClassification>,
  leaveWorkspace: HrLeaveWorkspaceResponse,
): HrDashboardStatCard[] {
  const workforce = getWorkforce(employees);
  const activeWorkforceTotal = classification.activeWorkforce.length;

  return [
    {
      key: "total-employees",
      label: "Total Employees",
      value: workforce.length,
      description: `${classification.activeWorkforce.length} active employees are currently tracked in HR.`,
      actionLabel: "View employees",
      href: "/dashboard/hr/employees",
      tone: "violet",
    },
    {
      key: "present-today",
      label: "Present Today",
      value: classification.presentIds.size,
      description: `${toPercentLabel(classification.presentIds.size, activeWorkforceTotal)} of active workforce is present today.`,
      actionLabel: "View attendance",
      href: "/dashboard/hr/attendance",
      tone: "emerald",
    },
    {
      key: "absent-today",
      label: "Absent Today",
      value: classification.absentIds.size,
      description: `${toPercentLabel(classification.absentIds.size, activeWorkforceTotal)} of active workforce has crossed the check-in threshold.`,
      actionLabel: "Review absentees",
      href: "/dashboard/hr/attendance",
      tone: "rose",
    },
    {
      key: "late-marks",
      label: "Late Marks Today",
      value: classification.lateIds.size,
      description: `${toPercentLabel(classification.lateIds.size, activeWorkforceTotal)} logged in after the allowed grace window.`,
      actionLabel: "View late marks",
      href: "/dashboard/hr/attendance",
      tone: "amber",
    },
    {
      key: "pending-leave",
      label: "Pending Leave Requests",
      value: leaveWorkspace.summary.pendingRequests,
      description: `${classification.onLeaveIds.size} employees are already on approved leave today.`,
      actionLabel: "View requests",
      href: "/dashboard/hr/leave",
      tone: "blue",
    },
  ];
}

function buildShiftAttendanceItems(
  employees: readonly HrEmployeeProfile[],
  shiftsWorkspace: HrShiftWorkspaceResponse,
  classification: ReturnType<typeof buildAttendanceClassification>,
): HrDashboardShiftAttendanceItem[] {
  const workforce = getActiveWorkforce(employees);
  const employeesByShift = new Map<string, HrEmployeeProfile[]>();

  for (const employee of workforce) {
    const shift = classification.shiftLookup.get(employee.id);
    const key = shift?.id ?? "unassigned";
    const current = employeesByShift.get(key);

    if (current) {
      current.push(employee);
      continue;
    }

    employeesByShift.set(key, [employee]);
  }

  const items = new Map<string, HrDashboardShiftAttendanceItem>();

  for (const shift of shiftsWorkspace.shifts) {
    const groupedEmployees = employeesByShift.get(shift.id) ?? [];
    const present = groupedEmployees.filter((employee) =>
      classification.presentIds.has(employee.id),
    ).length;
    const late = groupedEmployees.filter((employee) =>
      classification.lateIds.has(employee.id),
    ).length;
    const total = groupedEmployees.length;

    items.set(shift.id, {
      id: shift.id,
      label: shift.name,
      present,
      late,
      absent: Math.max(0, total - present - late),
      total,
    });
  }

  const unassignedEmployees = employeesByShift.get("unassigned") ?? [];

  if (unassignedEmployees.length > 0) {
    const present = unassignedEmployees.filter((employee) =>
      classification.presentIds.has(employee.id),
    ).length;
    const late = unassignedEmployees.filter((employee) =>
      classification.lateIds.has(employee.id),
    ).length;

    items.set("unassigned", {
      id: "unassigned",
      label: "Unassigned",
      present,
      late,
      absent: Math.max(0, unassignedEmployees.length - present - late),
      total: unassignedEmployees.length,
    });
  }

  return [...items.values()].filter((item) => item.total > 0);
}

function buildMissingPunchItems(
  employees: readonly HrEmployeeProfile[],
  classification: ReturnType<typeof buildAttendanceClassification>,
): HrDashboardMissingPunchItem[] {
  const employeeLookup = new Map(employees.map((employee) => [employee.id, employee]));
  const items: HrDashboardMissingPunchItem[] = [];

  for (const [userId, attendance] of classification.todayAttendanceLookup.entries()) {
    if (attendance.checkOutAt !== null) {
      continue;
    }

    const employee = employeeLookup.get(userId);

    if (!employee) {
      continue;
    }

    items.push({
      id: `checkout-${attendance.id}`,
      userId,
      employeeName: employee.fullName,
      employeeRole: toTitleCase(employee.role),
      profilePhotoUrl: employee.profilePhotoUrl,
      issue: "check-out-missing",
      issueLabel: "Check-out Missing",
      timeLabel: attendance.checkInAt
        ? `Checked in at ${toTimeLabel(attendance.checkInAt)}`
        : "Attendance session is missing a recorded check-in time",
    });
  }

  for (const employeeId of classification.absentIds) {
    const employee = employeeLookup.get(employeeId);

    if (!employee) {
      continue;
    }

    const shift = classification.shiftLookup.get(employee.id);
    const shiftTimeLabel = shift
      ? `Expected by ${formatClockLabel(shift.startTime)}`
      : "Expected by default shift time";

    items.push({
      id: `checkin-${employee.id}`,
      userId: employee.id,
      employeeName: employee.fullName,
      employeeRole: toTitleCase(employee.role),
      profilePhotoUrl: employee.profilePhotoUrl,
      issue: "check-in-missing",
      issueLabel: "Check-in Missing",
      timeLabel: shiftTimeLabel,
    });
  }

  return items
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName))
    .slice(0, 5);
}

function buildAlertItems(input: {
  lateCount: number;
  missingPunchCount: number;
  biometricFailureCount: number;
  pendingCorrectionsCount: number;
  activeOffboardingCount: number;
  pendingLeaveCount: number;
}): HrDashboardAlertItem[] {
  const items: HrDashboardAlertItem[] = [];

  if (input.missingPunchCount > 0) {
    items.push({
      id: "missing-punches",
      title: "Missing punches need closure",
      message: `${input.missingPunchCount} attendance entr${input.missingPunchCount === 1 ? "y needs" : "ies need"} check-in or check-out attention today.`,
      tone: "rose",
      href: "/dashboard/hr/attendance",
    });
  }

  if (input.pendingLeaveCount > 0) {
    items.push({
      id: "pending-leave",
      title: "Leave approvals are waiting",
      message: `${input.pendingLeaveCount} leave request${input.pendingLeaveCount === 1 ? "" : "s"} are pending HR review.`,
      tone: "blue",
      href: "/dashboard/hr/leave",
    });
  }

  if (input.lateCount > 0) {
    items.push({
      id: "late-arrivals",
      title: "Late arrivals recorded",
      message: `${input.lateCount} employee${input.lateCount === 1 ? " has" : "s have"} clocked in after the grace window today.`,
      tone: "amber",
      href: "/dashboard/hr/attendance",
    });
  }

  if (input.pendingCorrectionsCount > 0) {
    items.push({
      id: "attendance-corrections",
      title: "Attendance corrections pending",
      message: `${input.pendingCorrectionsCount} correction request${input.pendingCorrectionsCount === 1 ? "" : "s"} still need review.`,
      tone: "cyan",
      href: "/dashboard/hr/attendance",
    });
  }

  if (input.biometricFailureCount > 0) {
    items.push({
      id: "biometric-failure",
      title: "Biometric sync failed",
      message: `${input.biometricFailureCount} active device${input.biometricFailureCount === 1 ? " has" : "s have"} a failed sync status.`,
      tone: "amber",
      href: "/dashboard/hr/attendance",
    });
  }

  if (input.activeOffboardingCount > 0) {
    items.push({
      id: "offboarding-flow",
      title: "Notice period tracking active",
      message: `${input.activeOffboardingCount} employee${input.activeOffboardingCount === 1 ? " is" : "s are"} moving through offboarding or notice workflows.`,
      tone: "violet",
      href: "/dashboard/hr/offboarding",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      title: "No critical HR alerts",
      message: "Attendance, leave approvals, and device syncs look healthy right now.",
      tone: "emerald",
      href: "/dashboard/hr",
    });
  }

  return items.slice(0, 5);
}

function buildPendingLeaveItems(
  workspace: HrLeaveWorkspaceResponse,
): HrDashboardPendingLeaveItem[] {
  return workspace.items
    .filter((item) => item.status === "pending")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      employeeName: item.employee.fullName,
      profilePhotoUrl: item.employee.profilePhotoUrl ?? null,
      leaveType: item.leaveType,
      startDate: item.startDate,
      endDate: item.endDate,
      requestedDays: item.requestedDays,
    }));
}

function buildEmployeesOnLeaveTodayItems(
  leaveLookup: Map<string, HrLeaveWorkspaceResponse["items"][number]>,
): HrDashboardLeaveTodayItem[] {
  return [...leaveLookup.values()]
    .sort((left, right) => left.employee.fullName.localeCompare(right.employee.fullName))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      employeeName: item.employee.fullName,
      profilePhotoUrl: item.employee.profilePhotoUrl ?? null,
      departmentName: item.employee.department?.name ?? null,
      leaveType: item.leaveType,
      startDate: item.startDate,
      endDate: item.endDate,
    }));
}

function buildCalendarMarkers(
  currentDate: string,
  leaveWorkspace: HrLeaveWorkspaceResponse,
  holidays: readonly HolidayCalendarItem[],
): HrDashboardCalendarMarker[] {
  const monthStart = getMonthStart(currentDate);
  const monthEnd = getMonthEnd(currentDate);
  const markerCounts = new Map<string, number>();

  const increment = (
    date: string,
    kind: HrDashboardCalendarMarker["kind"],
    amount = 1,
  ) => {
    const key = `${date}:${kind}`;
    markerCounts.set(key, (markerCounts.get(key) ?? 0) + amount);
  };

  for (const holiday of holidays) {
    if (holiday.status !== "active" || !isSameMonth(holiday.date, currentDate)) {
      continue;
    }

    increment(holiday.date, "holiday");
  }

  for (const request of leaveWorkspace.items) {
    if (request.status !== "approved" && request.status !== "pending") {
      continue;
    }

    const overlapStart = Math.max(
      parseDateOnlyMs(request.startDate),
      parseDateOnlyMs(monthStart),
    );
    const overlapEnd = Math.min(
      parseDateOnlyMs(request.endDate),
      parseDateOnlyMs(monthEnd),
    );

    if (overlapEnd < overlapStart) {
      continue;
    }

    const kind: HrDashboardCalendarMarker["kind"] =
      request.status === "approved" ? "approved-leave" : "pending-leave";

    for (let cursor = overlapStart; cursor <= overlapEnd; cursor += MS_PER_DAY) {
      increment(formatDateOnlyMs(cursor), kind);
    }
  }

  return [...markerCounts.entries()].map(([entry, count]) => {
    const [date, kind] = entry.split(":") as [
      string,
      HrDashboardCalendarMarker["kind"],
    ];

    return {
      date,
      kind,
      count,
    };
  });
}

function buildLeaveBalanceAlerts(
  employees: readonly HrEmployeeProfile[],
  leaveWorkspace: HrLeaveWorkspaceResponse,
  currentDate: string,
): HrDashboardLeaveBalanceAlert[] {
  const activeWorkforce = getActiveWorkforce(employees);
  const employeeRequestLookup = buildEmployeeLeaveRequestLookup(leaveWorkspace);
  const usageWindow = resolveLeaveUsageWindow(
    leaveWorkspace.policy.leaveResetCycle,
    currentDate,
  );

  let lowBalanceCount = 0;
  let criticalBalanceCount = 0;
  let exhaustedCount = 0;

  for (const employee of activeWorkforce) {
    const requests = employeeRequestLookup.get(employee.id) ?? [];
    const usedDays = requests
      .filter((request) => request.status === "pending" || request.status === "approved")
      .reduce(
        (total, request) =>
          total +
          calculateOverlapDays(request.startDate, request.endDate, usageWindow),
        0,
      );
    const remainingDays = Math.max(
      0,
      leaveWorkspace.policy.maxDaysPerYear - usedDays,
    );

    if (remainingDays <= 2) {
      lowBalanceCount += 1;
    }

    if (remainingDays <= 1) {
      criticalBalanceCount += 1;
    }

    if (remainingDays === 0) {
      exhaustedCount += 1;
    }
  }

  return [
    {
      id: "low-balance",
      label: "Low leave balance",
      count: lowBalanceCount,
      description: "Employees with 2 or fewer leave days remaining in the current cycle.",
    },
    {
      id: "critical-balance",
      label: "Critical leave balance",
      count: criticalBalanceCount,
      description: "Employees with 1 or fewer leave days remaining right now.",
    },
    {
      id: "exhausted-balance",
      label: "Leave fully exhausted",
      count: exhaustedCount,
      description: "Employees who have no remaining annual leave balance.",
    },
  ];
}

function buildRecentJoiners(
  employees: readonly HrEmployeeProfile[],
  currentDate: string,
): HrDashboardRecentJoiner[] {
  return getWorkforce(employees)
    .filter((employee) => isSameMonth(employee.createdAt, currentDate))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 4)
    .map((employee) => ({
      userId: employee.id,
      fullName: employee.fullName,
      profilePhotoUrl: employee.profilePhotoUrl,
      departmentName: employee.department?.name ?? null,
      createdAt: employee.createdAt,
    }));
}

function buildLifecycleOverview(input: {
  employees: readonly HrEmployeeProfile[];
  currentDate: string;
  onboardingWorkspace: OnboardingWorkspaceResponse;
  offboardingWorkspace: OffboardingWorkspaceResponse;
}): HrDashboardOverview["lifecycle"] {
  const activeWorkforce = getActiveWorkforce(input.employees);
  const probationThreshold = addDays(
    parseDateOnlyMs(input.currentDate),
    -(PROBATION_WINDOW_DAYS - 1),
  );
  const onboardingInProgress = input.onboardingWorkspace.requests.filter(
    (request) => request.status === "pending" || request.status === "approved",
  ).length;
  const noticePeriodEmployees = input.offboardingWorkspace.requests.filter(
    (request) => request.status === "pending" || request.status === "approved",
  ).length;
  const exitsThisMonth = input.offboardingWorkspace.requests.filter(
    (request) =>
      request.status === "completed" &&
      request.completedAt !== null &&
      isSameMonth(request.completedAt, input.currentDate),
  ).length;

  return {
    newJoinersThisMonth: getWorkforce(input.employees).filter((employee) =>
      isSameMonth(employee.createdAt, input.currentDate),
    ).length,
    onboardingInProgress,
    probationEmployees: activeWorkforce.filter(
      (employee) => parseDateOnlyMs(employee.createdAt.slice(0, 10)) >= probationThreshold,
    ).length,
    noticePeriodEmployees,
    exitsThisMonth,
    recentJoiners: buildRecentJoiners(input.employees, input.currentDate),
  };
}

function buildPayrollReadinessItems(
  payrollOverview: PayrollOverviewResponse,
  attendanceCorrectionsWorkspace: HrAttendanceCorrectionWorkspaceResponse,
  leaveWorkspace: HrLeaveWorkspaceResponse,
): HrDashboardReadinessItem[] {
  return [
    {
      id: "attendance-corrections",
      label: "Pending Attendance Corrections",
      value: attendanceCorrectionsWorkspace.summary.pendingRequests,
      description: "Open attendance correction requests that can block payroll confidence.",
      tone: "rose",
    },
    {
      id: "missing-salary-structure",
      label: "Missing Salary Structures",
      value: payrollOverview.readiness.payroll.employeesMissingSalaryStructure,
      description: "Active employees who still need a mapped salary structure.",
      tone: "amber",
    },
    {
      id: "missing-organization",
      label: "Missing Organization Mapping",
      value: payrollOverview.readiness.payroll.employeesMissingOrganization,
      description: "Employees missing department or designation mapping.",
      tone: "blue",
    },
    {
      id: "pending-leave-requests",
      label: "Pending Leave Requests",
      value: leaveWorkspace.summary.pendingRequests,
      description: "Leave decisions still waiting and likely to affect the payroll cycle.",
      tone: "violet",
    },
    {
      id: "active-salary-structures",
      label: "Active Salary Structures",
      value: payrollOverview.readiness.payroll.activeSalaryStructures,
      description: "Configured active salary structures available for payroll processing.",
      tone: "emerald",
    },
  ];
}

function buildNotificationItems(
  workspace: NotificationsWorkspaceResponse,
): HrDashboardNotificationItem[] {
  return workspace.notifications.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt,
    status: item.status,
  }));
}

function buildHighlightCards(input: {
  currentDate: string;
  leaveWorkspace: HrLeaveWorkspaceResponse;
  payrollSettings: AdminPayrollSettingsView;
  announcementsWorkspace: AnnouncementManagementWorkspaceResponse;
  holidays: readonly HolidayCalendarItem[];
}): HrDashboardHighlightCard[] {
  const nextHoliday =
    input.holidays.find(
      (holiday) =>
        holiday.status === "active" &&
        parseDateOnlyMs(holiday.date) >= parseDateOnlyMs(input.currentDate),
    ) ?? null;
  const latestAnnouncement =
    input.announcementsWorkspace.items.find((item) => item.status === "active") ??
    input.announcementsWorkspace.items[0] ??
    null;

  return [
    {
      key: "office-holiday",
      eyebrow: "Office Holiday",
      title: nextHoliday?.name ?? "No upcoming holiday",
      description: nextHoliday
        ? `${nextHoliday.day}, ${nextHoliday.date}${nextHoliday.office ? ` for ${nextHoliday.office.name}` : ""}.`
        : "No active company holiday is scheduled in the current list.",
      actionLabel: "View holidays",
      href: "/dashboard/hr/holidays",
      tone: "violet",
    },
    {
      key: "policy-update",
      eyebrow: "Policy Update",
      title: `${input.leaveWorkspace.policy.maxDaysPerYear} annual leave days`,
      description: `Reset cycle: ${formatLeaveResetCycle(input.leaveWorkspace.policy.leaveResetCycle)}. Half-day leave is ${input.leaveWorkspace.policy.allowHalfDay ? "configured" : "disabled"}.`,
      actionLabel: "Review leave desk",
      href: "/dashboard/hr/leave",
      tone: "blue",
    },
    {
      key: "payroll-update",
      eyebrow: "Payroll Update",
      title: `${formatPayrollCycle(input.payrollSettings.salaryCycle)} payroll cycle`,
      description: `Payroll locks on day ${input.payrollSettings.payrollLockDay} and payslips publish on day ${input.payrollSettings.payslipPublishDay}.`,
      actionLabel: "Open reports",
      href: "/dashboard/hr/reports",
      tone: "emerald",
    },
    {
      key: "announcement-update",
      eyebrow: "Workplace Update",
      title: latestAnnouncement?.title ?? "No active announcement",
      description:
        latestAnnouncement?.summary ??
        "Company-wide updates will appear here once an announcement is published.",
      actionLabel: "View notifications",
      href: "/dashboard/notifications",
      tone: "amber",
    },
  ];
}

export function buildHrDashboardOverview(
  input: DashboardBuilderInput,
): HrDashboardOverview {
  const classification = buildAttendanceClassification(
    input.employees,
    input.currentDate,
    input.attendanceWorkspace,
    input.leaveWorkspace,
    input.shiftsWorkspace,
    input.attendanceSettings,
  );
  const attendanceStatus = resolveAttendanceStatus(input.attendanceWorkspace);
  const activeOffboardingCount = input.offboardingWorkspace.requests.filter(
    (request) => request.status === "pending" || request.status === "approved",
  ).length;
  const failedBiometricDevices = input.biometricDevices.filter(
    (device) => device.isActive && device.lastSyncStatus === "failed",
  ).length;
  const missingPunchItems = buildMissingPunchItems(input.employees, classification);
  const shiftAttendanceItems = buildShiftAttendanceItems(
    input.employees,
    input.shiftsWorkspace,
    classification,
  );

  return {
    meta: {
      currentDate: input.currentDate,
      currentMonthLabel: buildMonthLabel(input.currentDate),
      payrollCycleLabel: buildMonthLabel(input.currentDate),
      attendanceStatusLabel: attendanceStatus.label,
      attendanceStatusTone: attendanceStatus.tone,
    },
    statCards: buildStatCards(
      input.employees,
      classification,
      input.leaveWorkspace,
    ),
    attendanceSummary: {
      totalEmployees: classification.activeWorkforce.length,
      segments: buildAttendanceSegments(classification),
    },
    shiftAttendance: {
      items: shiftAttendanceItems,
    },
    missingPunches: {
      items: missingPunchItems,
    },
    alerts: {
      items: buildAlertItems({
        lateCount: classification.lateIds.size,
        missingPunchCount: missingPunchItems.length,
        biometricFailureCount: failedBiometricDevices,
        pendingCorrectionsCount:
          input.attendanceCorrectionsWorkspace.summary.pendingRequests,
        activeOffboardingCount,
        pendingLeaveCount: input.leaveWorkspace.summary.pendingRequests,
      }),
    },
    pendingLeaveRequests: {
      total: input.leaveWorkspace.summary.pendingRequests,
      items: buildPendingLeaveItems(input.leaveWorkspace),
    },
    employeesOnLeaveToday: {
      total: classification.approvedLeaveLookup.size,
      items: buildEmployeesOnLeaveTodayItems(classification.approvedLeaveLookup),
    },
    leaveCalendar: {
      currentDate: input.currentDate,
      markers: buildCalendarMarkers(
        input.currentDate,
        input.leaveWorkspace,
        input.holidays,
      ),
    },
    leaveBalanceAlerts: {
      items: buildLeaveBalanceAlerts(
        input.employees,
        input.leaveWorkspace,
        input.currentDate,
      ),
    },
    lifecycle: buildLifecycleOverview({
      employees: input.employees,
      currentDate: input.currentDate,
      onboardingWorkspace: input.onboardingWorkspace,
      offboardingWorkspace: input.offboardingWorkspace,
    }),
    payrollReadiness: {
      readinessPercent:
        input.payrollOverview.summary.activeEmployees > 0
          ? Math.round(
              (input.payrollOverview.summary.readyEmployees /
                input.payrollOverview.summary.activeEmployees) *
                100,
            )
          : 0,
      readyEmployees: input.payrollOverview.summary.readyEmployees,
      totalEmployees: input.payrollOverview.summary.activeEmployees,
      items: buildPayrollReadinessItems(
        input.payrollOverview,
        input.attendanceCorrectionsWorkspace,
        input.leaveWorkspace,
      ),
    },
    notifications: {
      unreadCount: input.notificationsWorkspace.summary.unreadNotifications,
      items: buildNotificationItems(input.notificationsWorkspace),
    },
    highlights: {
      items: buildHighlightCards({
        currentDate: input.currentDate,
        leaveWorkspace: input.leaveWorkspace,
        payrollSettings: input.payrollSettings,
        announcementsWorkspace: input.announcementsWorkspace,
        holidays: input.holidays,
      }),
    },
  };
}
