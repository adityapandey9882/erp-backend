import type {
  CompanyAdminCandidate,
  CompanyModuleDefinition,
  CompanyModuleKey,
  CompanyOnboardingStatus,
  CompanyStatus,
  CompanyView,
} from "../companies/companies.types.js";
import type {
  UserAccountStatus,
} from "../users/users.types.js";
import type { AppRole } from "../roles/roles.types.js";

export type SuperadminAdminStatus = "active" | "inactive" | "suspended";

export type SuperadminAdminView = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: SuperadminAdminStatus;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
};

export type SuperadminRecentActivity = {
  id: string;
  company: {
    id: string;
    name: string;
    code: string;
  } | null;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SuperadminModuleUsageEntry = CompanyModuleDefinition & {
  enabledCompanies: number;
  totalCompanies: number;
};

export type SuperadminOverviewResponse = {
  summary: {
    totalCompanies: number;
    activeCompanies: number;
    inactiveCompanies: number;
    companyAdminsAssigned: number;
    totalAdmins: number;
    totalUsers: number;
    totalAssets: number;
  };
  onboardingSummary: Record<CompanyOnboardingStatus, number>;
  recentCompanies: CompanyView[];
  recentActivities: SuperadminRecentActivity[];
  moduleUsage: SuperadminModuleUsageEntry[];
};

export type SuperadminAdminsWorkspaceResponse = {
  admins: SuperadminAdminView[];
  availableAdmins: CompanyAdminCandidate[];
  companies: Array<{
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
    onboardingStatus: CompanyOnboardingStatus;
    archivedAt: string | null;
    admin: CompanyView["admin"];
  }>;
};

export type SuperadminModulesWorkspaceResponse = {
  availableModules: CompanyModuleDefinition[];
  companies: Array<{
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
    onboardingStatus: CompanyOnboardingStatus;
    enabledModules: CompanyModuleKey[];
  }>;
  moduleVisibilitySummary: SuperadminModuleUsageEntry[];
};

export type CreateSuperadminAdminRequest = {
  fullName: string;
  email: string;
  password: string;
  status: UserAccountStatus;
  companyId?: string;
};

export type UpdateSuperadminAdminRequest = {
  fullName?: string;
  email?: string;
  phone?: string | null;
};

export type SetSuperadminAdminPasswordRequest = {
  newPassword: string;
  confirmPassword: string;
};

export type UnassignSuperadminAdminRequest = {
  companyId: string;
};

export type SuperadminAdminMutationResponse = {
  message: string;
  admin: SuperadminAdminView;
};

export type SuperadminAdminPasswordResetResponse = {
  message: string;
  admin: SuperadminAdminView;
  temporaryPassword: string;
};

export type SuperadminAdminPasswordSetResponse = {
  message: string;
  admin: SuperadminAdminView;
};

export type SuperadminAdminDeleteResponse = {
  message: string;
  deletedAdminId: string;
};

export type SuperadminAuditLogFilters = {
  companyId?: string | null;
  action?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
};

export type SuperadminAuditLogView = {
  id: string;
  company: {
    id: string;
    name: string;
    code: string;
  } | null;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SuperadminAuditLogsResponse = {
  summary: {
    totalLogs: number;
    filteredLogs: number;
    uniqueCompanies: number;
    uniqueActions: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  activeFilters: {
    companyId: string | null;
    action: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  availableCompanies: Array<{
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
    onboardingStatus: CompanyOnboardingStatus;
  }>;
  availableActions: string[];
  logs: SuperadminAuditLogView[];
};

export type SuperadminSettingsGeneral = {
  platformName: string;
  platformDomain: string;
  supportEmail: string;
  timezone: string;
  dateFormat: string;
};

export type SuperadminSettingsSecurity = {
  minimumPasswordLength: number;
  enforceGlobalMfa: boolean;
  googleSsoEnabled: boolean;
  samlSsoEnabled: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  sessionTimeoutMinutes: number;
};

export type PasswordPolicyView = Pick<
  SuperadminSettingsSecurity,
  | "minimumPasswordLength"
  | "requireUppercase"
  | "requireNumber"
  | "requireSpecialCharacter"
>;

export type SuperadminSettingsNotifications = {
  companyUserCreated: boolean;
  assetAssigned: boolean;
  leaveStatusChanged: boolean;
  procurementCreated: boolean;
};

export type SuperadminSettingsModules = {
  defaultEnabledModules: CompanyModuleKey[];
};

export type MaintenanceTargetRole = Exclude<AppRole, "superadmin">;
export type MaintenanceScope = "all" | "selected";

export type SuperadminSettingsOperations = {
  maintenanceMode: boolean;
  maintenanceScope: MaintenanceScope;
  maintenanceTargets: MaintenanceTargetRole[];
};

export type SuperadminSettingsView = {
  general: SuperadminSettingsGeneral;
  security: SuperadminSettingsSecurity;
  notifications: SuperadminSettingsNotifications;
  modules: SuperadminSettingsModules;
  operations: SuperadminSettingsOperations;
};

export type PlatformRuntimeView = {
  platformName: string;
  platformDomain: string;
  supportEmail: string;
  maintenanceMode: boolean;
  maintenanceScope: MaintenanceScope;
  maintenanceTargets: MaintenanceTargetRole[];
  passwordPolicy: PasswordPolicyView;
};

export type SuperadminSettingsResponse = {
  settings: SuperadminSettingsView;
};

export type UpdateSuperadminSettingsRequest = SuperadminSettingsView;

export type SuperadminSettingsMutationResponse = {
  message: string;
  settings: SuperadminSettingsView;
};

export type SuperadminServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type SuperadminServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type SuperadminServiceResult<T> =
  | SuperadminServiceSuccess<T>
  | SuperadminServiceFailure;
