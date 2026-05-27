import type {
  CompanyModuleDefinition,
  CompanyView,
} from "../companies/companies.types.js";
import type { AppRole } from "../roles/roles.types.js";

export type AdminOverviewTrendDirection = "up" | "down" | "flat";

export type AdminOverviewTrend = {
  value: number;
  label: string;
  direction: AdminOverviewTrendDirection;
};

export type AdminRoleSummary = {
  role: AppRole;
  label: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
};

export type AdminOverviewOffice = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isPrimary: boolean;
};

export type AdminOverviewAttendance = {
  attendanceDate: string;
  totalEmployees: number;
  totalActiveEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  notCheckedInToday: number;
  leaveToday: number;
  activeNow: number;
  averageCheckInMinutes: number | null;
  averageCheckOutMinutes: number | null;
  totalWorkedMinutes: number;
  overtimeMinutes: number;
  trends: {
    totalEmployees: AdminOverviewTrend;
    presentToday: AdminOverviewTrend;
    absentToday: AdminOverviewTrend;
    lateToday: AdminOverviewTrend;
  };
};

export type AdminOverviewActivityItem = {
  id: string;
  employeeName: string;
  employeeEmail: string;
  action: "Checked in" | "Checked out";
  occurredAt: string;
};

export type AdminOverviewPendingAction = {
  key:
    | "leave-requests"
    | "attendance-corrections"
    | "document-approvals"
    | "salary-approvals"
    | "resignation-requests";
  label: string;
  count: number;
  href: string;
  tone: "amber" | "rose" | "blue" | "emerald" | "violet";
};

export type AdminOverviewAlert = {
  key:
    | "not-checked-in"
    | "frequent-late-arrivals"
    | "attendance-anomalies"
    | "leave-today";
  title: string;
  value: number;
  unit: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "rose" | "amber" | "violet" | "blue";
};

export type AdminOverviewAnnouncement = {
  id: string;
  title: string;
  summary: string;
  priority: "High" | "Medium" | "Low";
  publishedAt: string;
  postedBy: string;
};

export type AdminOverviewSystemHealth = {
  database: {
    status: "healthy";
    label: string;
  };
  storage: {
    usedBytes: number;
    quotaBytes: number;
    usedPercent: number;
  };
  emailService: {
    status: "active" | "disabled";
    label: string;
  };
  backup: {
    status: "successful" | "not-configured";
    label: string;
    lastBackupAt: string | null;
  };
};

export type AdminOverviewCompanySnapshot = {
  companyName: string;
  industry: string;
  totalEmployees: number;
  totalOffices: number;
  departments: number;
  joinedOn: string;
};

export type AdminOverviewOperations = {
  office: AdminOverviewOffice | null;
  attendance: AdminOverviewAttendance;
  liveActivity: AdminOverviewActivityItem[];
  pendingActions: AdminOverviewPendingAction[];
  pendingRequestTotal: number;
  alerts: AdminOverviewAlert[];
  announcements: AdminOverviewAnnouncement[];
  companySnapshot: AdminOverviewCompanySnapshot | null;
  systemHealth: AdminOverviewSystemHealth;
};

export type AdminOverviewResponse = {
  company: CompanyView | null;
  summary: {
    totalAssignedUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    enabledModules: number;
    disabledModules: number;
    configuredRoles: number;
  };
  users: {
    assignedAdmin: CompanyView["admin"];
    roleBreakdown: AdminRoleSummary[];
  };
  modules: {
    enabled: CompanyModuleDefinition[];
    disabled: CompanyModuleDefinition[];
  };
  operations: AdminOverviewOperations;
};
