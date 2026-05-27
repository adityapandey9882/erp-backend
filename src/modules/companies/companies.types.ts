export const COMPANY_STATUSES = ["active", "inactive"] as const;
export const COMPANY_ONBOARDING_STATUSES = [
  "pending",
  "active",
  "suspended",
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];
export type CompanyOnboardingStatus =
  (typeof COMPANY_ONBOARDING_STATUSES)[number];

export const COMPANY_MODULE_KEYS = [
  "admin",
  "hr",
  "accounts",
  "payroll",
  "projects",
  "team-lead",
  "employee-self",
] as const;

export type CompanyModuleKey = (typeof COMPANY_MODULE_KEYS)[number];

export type CompanyModuleDefinition = {
  key: CompanyModuleKey;
  label: string;
  description: string;
  dashboardPath: string;
};

export const COMPANY_MODULE_DEFINITIONS: Record<
  CompanyModuleKey,
  CompanyModuleDefinition
> = {
  admin: {
    key: "admin",
    label: "Admin Workspace",
    description: "Operational administration and organization configuration.",
    dashboardPath: "/dashboard/admin",
  },
  hr: {
    key: "hr",
    label: "HR Workspace",
    description: "People operations, records, and workforce administration.",
    dashboardPath: "/dashboard/hr",
  },
  accounts: {
    key: "accounts",
    label: "Accounts Workspace",
    description: "Finance coordination, payroll readiness, and accounting flow.",
    dashboardPath: "/dashboard/accounts",
  },
  payroll: {
    key: "payroll",
    label: "Payroll Module",
    description: "Salary processing, reimbursements, and payroll operations.",
    dashboardPath: "/dashboard/accounts",
  },
  projects: {
    key: "projects",
    label: "Projects Module",
    description: "Project execution, delivery visibility, and planning context.",
    dashboardPath: "/dashboard/project-manager",
  },
  "team-lead": {
    key: "team-lead",
    label: "Team Lead Workspace",
    description: "Team execution oversight, assignment flow, and coordination.",
    dashboardPath: "/dashboard/team-lead",
  },
  "employee-self": {
    key: "employee-self",
    label: "Employee Self-Service",
    description: "Self-service access to profile, documents, and assigned work.",
    dashboardPath: "/dashboard/employee",
  },
};

export type CompanyAdminCandidate = {
  id: string;
  fullName: string;
  email: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactEmail: string;
  logoUrl: string | null;
  status: CompanyStatus;
  onboardingStatus: CompanyOnboardingStatus;
  archivedAt: string | null;
  assignedAdminUserId: string | null;
  enabledModules: CompanyModuleKey[];
  createdAt: string;
  updatedAt: string;
};

export type CompanyView = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactEmail: string;
  logoUrl: string | null;
  status: CompanyStatus;
  onboardingStatus: CompanyOnboardingStatus;
  archivedAt: string | null;
  admin: CompanyAdminCandidate | null;
  enabledModules: CompanyModuleKey[];
  createdAt: string;
  updatedAt: string;
};

export type CompanyDependencySummaryItem = {
  code: string;
  label: string;
  count: number;
};

export type CompaniesWorkspaceResponse = {
  items: CompanyView[];
  availableAdmins: CompanyAdminCandidate[];
  availableModules: CompanyModuleDefinition[];
};

export type CompanyDetailResponse = {
  company: CompanyView;
  availableAdmins: CompanyAdminCandidate[];
  availableModules: CompanyModuleDefinition[];
  dependencySummary: CompanyDependencySummaryItem[];
};

export type CreateCompanyRequest = {
  name: string;
  code: string;
  industry: string;
  contactEmail: string;
};

export type UpdateCompanyRequest = CreateCompanyRequest & {
  onboardingStatus: CompanyOnboardingStatus;
};

export type UpdateCompanyStatusRequest = {
  status: CompanyStatus;
};

export type UpdateCompanyLogoRequest = {
  logoUrl: string | null;
};

export type AssignCompanyAdminRequest = {
  adminUserId: string;
};

export type UpdateCompanyModulesRequest = {
  enabledModules: CompanyModuleKey[];
};

export type CompanyMutationResponse = {
  message: string;
  company: CompanyView;
};

export type CompanyDeleteResponse = {
  message: string;
  deletedCompanyId: string;
};

export type CompaniesServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type CompaniesServiceFailure = {
  ok: false;
  status: 404 | 409;
  message: string;
};

export type CompaniesServiceResult<T> =
  | CompaniesServiceSuccess<T>
  | CompaniesServiceFailure;

export function isCompanyStatus(value: string): value is CompanyStatus {
  return COMPANY_STATUSES.includes(value as CompanyStatus);
}

export function isCompanyOnboardingStatus(
  value: string,
): value is CompanyOnboardingStatus {
  return COMPANY_ONBOARDING_STATUSES.includes(value as CompanyOnboardingStatus);
}

export function isCompanyModuleKey(value: string): value is CompanyModuleKey {
  return COMPANY_MODULE_KEYS.includes(value as CompanyModuleKey);
}

export function normalizeCompanyModules(
  modules: readonly string[],
): CompanyModuleKey[] {
  const normalized = new Set(modules.filter(isCompanyModuleKey));

  return COMPANY_MODULE_KEYS.filter((key) => normalized.has(key));
}
