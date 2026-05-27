import { companiesService } from "../companies/companies.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import type {
  AdminOverviewAlert,
  AdminOverviewAttendance,
  AdminOverviewOperations,
  AdminOverviewPendingAction,
  AdminOverviewResponse,
  AdminOverviewTrend,
  AdminRoleSummary,
} from "./admin.types.js";
import {
  adminRepository,
  type AdminAttendanceSummary,
  type AdminPendingActionCounts,
} from "./admin.repository.js";

function buildTrend(value: number, previousValue: number, label: string): AdminOverviewTrend {
  const delta = value - previousValue;

  return {
    value: Math.abs(delta),
    label,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function buildEmptyOperations(): AdminOverviewOperations {
  return {
    office: null,
    attendance: {
      attendanceDate: new Date().toISOString().slice(0, 10),
      totalEmployees: 0,
      totalActiveEmployees: 0,
      presentToday: 0,
      absentToday: 0,
      lateToday: 0,
      notCheckedInToday: 0,
      leaveToday: 0,
      activeNow: 0,
      averageCheckInMinutes: null,
      averageCheckOutMinutes: null,
      totalWorkedMinutes: 0,
      overtimeMinutes: 0,
      trends: {
        totalEmployees: {
          value: 0,
          label: "vs this month",
          direction: "flat",
        },
        presentToday: {
          value: 0,
          label: "vs yesterday",
          direction: "flat",
        },
        absentToday: {
          value: 0,
          label: "vs yesterday",
          direction: "flat",
        },
        lateToday: {
          value: 0,
          label: "vs yesterday",
          direction: "flat",
        },
      },
    },
    liveActivity: [],
    pendingActions: [],
    pendingRequestTotal: 0,
    alerts: [],
    announcements: [],
    companySnapshot: null,
    systemHealth: {
      database: {
        status: "healthy",
        label: "Healthy",
      },
      storage: {
        usedBytes: 0,
        quotaBytes: 5 * 1024 * 1024 * 1024,
        usedPercent: 0,
      },
      emailService: {
        status: "disabled",
        label: "Unavailable",
      },
      backup: {
        status: "not-configured",
        label: "Not configured",
        lastBackupAt: null,
      },
    },
  };
}

function buildEmptyOverview(): AdminOverviewResponse {
  return {
    company: null,
    summary: {
      totalAssignedUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      enabledModules: 0,
      disabledModules: 0,
      configuredRoles: 0,
    },
    users: {
      assignedAdmin: null,
      roleBreakdown: [],
    },
    modules: {
      enabled: [],
      disabled: [],
    },
    operations: buildEmptyOperations(),
  };
}

function summarizeRoleBreakdown(roleBreakdown: readonly AdminRoleSummary[]) {
  return roleBreakdown.reduce(
    (summary, roleEntry) => ({
      totalAssignedUsers: summary.totalAssignedUsers + roleEntry.totalUsers,
      activeUsers: summary.activeUsers + roleEntry.activeUsers,
      inactiveUsers: summary.inactiveUsers + roleEntry.inactiveUsers,
      configuredRoles: summary.configuredRoles + 1,
    }),
    {
      totalAssignedUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      configuredRoles: 0,
    },
  );
}

function buildAttendance(summary: AdminAttendanceSummary): AdminOverviewAttendance {
  return {
    attendanceDate: summary.attendanceDate,
    totalEmployees: summary.totalEmployees,
    totalActiveEmployees: summary.totalActiveEmployees,
    presentToday: summary.presentToday,
    absentToday: summary.absentToday,
    lateToday: summary.lateToday,
    notCheckedInToday: summary.notCheckedInToday,
    leaveToday: summary.leaveToday,
    activeNow: summary.activeNow,
    averageCheckInMinutes: summary.averageCheckInMinutes,
    averageCheckOutMinutes: summary.averageCheckOutMinutes,
    totalWorkedMinutes: summary.totalWorkedMinutes,
    overtimeMinutes: summary.overtimeMinutes,
    trends: {
      totalEmployees: {
        value: summary.employeeGrowth,
        label: "vs this month",
        direction: summary.employeeGrowth > 0 ? "up" : "flat",
      },
      presentToday: buildTrend(
        summary.presentToday,
        summary.presentYesterday,
        "vs yesterday",
      ),
      absentToday: buildTrend(
        summary.absentToday,
        summary.absentYesterday,
        "vs yesterday",
      ),
      lateToday: buildTrend(
        summary.lateToday,
        summary.lateYesterday,
        "vs yesterday",
      ),
    },
  };
}

function buildPendingActions(
  counts: AdminPendingActionCounts,
): AdminOverviewPendingAction[] {
  return [
    {
      key: "leave-requests",
      label: "Leave Requests",
      count: counts.leaveRequests,
      href: "/dashboard/hr/leave",
      tone: "amber",
    },
    {
      key: "attendance-corrections",
      label: "Attendance Corrections",
      count: counts.attendanceCorrections,
      href: "/dashboard/hr/attendance",
      tone: "rose",
    },
    {
      key: "document-approvals",
      label: "Document Approvals",
      count: counts.documentApprovals,
      href: "/dashboard/admin/documents",
      tone: "blue",
    },
    {
      key: "salary-approvals",
      label: "Salary Approvals",
      count: counts.salaryApprovals,
      href: "/dashboard/accounts/payroll",
      tone: "emerald",
    },
    {
      key: "resignation-requests",
      label: "Resignation Requests",
      count: counts.resignationRequests,
      href: "/dashboard/hr/offboarding",
      tone: "violet",
    },
  ];
}

function buildAlerts(
  summary: AdminAttendanceSummary,
): AdminOverviewAlert[] {
  return [
    {
      key: "not-checked-in",
      title: "Not Checked-in",
      value: summary.notCheckedInToday,
      unit: summary.notCheckedInToday === 1 ? "Employee" : "Employees",
      description: "Not checked-in yet today",
      href: "/dashboard/hr/attendance",
      actionLabel: "View Employees",
      tone: "rose",
    },
    {
      key: "frequent-late-arrivals",
      title: "Frequent Late Arrivals",
      value: summary.frequentLateEmployees,
      unit: summary.frequentLateEmployees === 1 ? "Employee" : "Employees",
      description: "More than 2 times this week",
      href: "/dashboard/hr/attendance",
      actionLabel: "View Employees",
      tone: "amber",
    },
    {
      key: "attendance-anomalies",
      title: "Attendance Anomalies",
      value: summary.anomalyCount,
      unit: summary.anomalyCount === 1 ? "Employee" : "Employees",
      description: "Irregular patterns detected",
      href: "/dashboard/hr/attendance",
      actionLabel: "View Details",
      tone: "violet",
    },
    {
      key: "leave-today",
      title: "Leave Today",
      value: summary.leaveToday,
      unit: summary.leaveToday === 1 ? "Employee" : "Employees",
      description: "On leave today",
      href: "/dashboard/hr/leave",
      actionLabel: "View Leaves",
      tone: "blue",
    },
  ];
}

export const adminService = {
  async getOverview(user: AuthenticatedUser): Promise<AdminOverviewResponse> {
    if (!user.companyId) {
      return buildEmptyOverview();
    }

    const [
      company,
      roleBreakdown,
      attendanceSummary,
      liveActivity,
      pendingCounts,
      announcements,
      office,
      snapshotCounts,
      systemHealth,
    ] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      adminRepository.getCompanyUserSummary(user.companyId),
      adminRepository.getAttendanceSummary(user.companyId),
      adminRepository.listLiveActivity(user.companyId),
      adminRepository.getPendingActionCounts(user.companyId),
      adminRepository.listLatestAnnouncements(user.companyId),
      adminRepository.findPrimaryOffice(user.companyId),
      adminRepository.getCompanySnapshotCounts(user.companyId),
      adminRepository.getSystemHealth(user.companyId),
    ]);

    if (!company) {
      return buildEmptyOverview();
    }

    const availableModules = companiesService.listAvailableModules();
    const enabledModules = availableModules.filter((moduleDefinition) =>
      company.enabledModules.includes(moduleDefinition.key),
    );
    const disabledModules = availableModules.filter(
      (moduleDefinition) => !company.enabledModules.includes(moduleDefinition.key),
    );
    const userSummary = summarizeRoleBreakdown(roleBreakdown);
    const attendance = buildAttendance(attendanceSummary);
    const pendingActions = buildPendingActions(pendingCounts);

    return {
      company,
      summary: {
        ...userSummary,
        enabledModules: enabledModules.length,
        disabledModules: disabledModules.length,
      },
      users: {
        assignedAdmin: company.admin,
        roleBreakdown,
      },
      modules: {
        enabled: enabledModules,
        disabled: disabledModules,
      },
      operations: {
        office,
        attendance,
        liveActivity,
        pendingActions,
        pendingRequestTotal: pendingActions.reduce(
          (total, action) => total + action.count,
          0,
        ),
        alerts: buildAlerts(attendanceSummary),
        announcements,
        companySnapshot: {
          companyName: company.name,
          industry: company.industry,
          totalEmployees: attendance.totalActiveEmployees,
          totalOffices: snapshotCounts.totalOffices,
          departments: snapshotCounts.departments,
          joinedOn: company.createdAt,
        },
        systemHealth,
      },
    };
  },
};
