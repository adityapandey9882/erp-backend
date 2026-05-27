import type { CompanyStatus } from "../companies/companies.types.js";
import type {
  CompanyUserDepartmentSummary,
  CompanyUserDesignationSummary,
  CompanyUserProfile,
} from "../users/users.types.js";

export const SALARY_STRUCTURE_STATUSES = ["active", "inactive"] as const;
export const PAYROLL_FOUNDATION_STATUSES = [
  "ready",
  "missing-organization",
  "missing-salary-structure",
  "inactive",
] as const;
export const PAYROLL_CYCLE_READINESS_STATUSES = [
  "not-started",
  "partial",
  "ready",
] as const;
export const PAYROLL_RUN_STATUSES = ["draft", "processed"] as const;

export type SalaryStructureStatus = (typeof SALARY_STRUCTURE_STATUSES)[number];
export type PayrollFoundationStatus =
  (typeof PAYROLL_FOUNDATION_STATUSES)[number];
export type PayrollCycleReadinessStatus =
  (typeof PAYROLL_CYCLE_READINESS_STATUSES)[number];
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export type SalaryStructureView = {
  id: string;
  designation: CompanyUserDesignationSummary;
  baseAmount: number;
  currencyCode: string;
  status: SalaryStructureStatus;
  createdAt: string;
  updatedAt: string;
};

export type PayrollDesignationOption = {
  id: string;
  title: string;
  code: string;
  department: CompanyUserDepartmentSummary | null;
  employeeCount: number;
  hasSalaryStructure: boolean;
};

export type PayrollEmployeeSalaryStructureSummary = Pick<
  SalaryStructureView,
  "id" | "baseAmount" | "currencyCode" | "status" | "updatedAt"
>;

export type PayrollEmployeeFoundationEntry = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role" | "status" | "department" | "designation"
> & {
  attendanceRecordsThisMonth: number;
  latestAttendanceDate: string | null;
  leaveSummary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  };
  salaryStructure: PayrollEmployeeSalaryStructureSummary | null;
  payrollFoundationStatus: PayrollFoundationStatus;
};

export type PayrollRunPeriod = {
  month: number;
  year: number;
  label: string;
};

export type PayrollRunSummary = {
  id: string;
  companyId: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  employeeCount: number;
  totalBaseSalary: number;
  totalFinalSalary: number;
  createdAt: string;
};

export type PayrollRecordEmployeeSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "status" | "department" | "designation"
>;

export type PayrollRecordReference = {
  attendanceRecords: number;
  completedAttendanceRecords: number;
  approvedLeaveDays: number;
};

export type PayrollRecordView = {
  id: string;
  runId: string;
  userId: string;
  employee: PayrollRecordEmployeeSummary;
  baseSalary: number;
  finalSalary: number;
  currencyCode: string;
  reference: PayrollRecordReference;
  createdAt: string;
};

export type PayrollRunDetail = PayrollRunSummary & {
  period: PayrollRunPeriod;
  records: PayrollRecordView[];
};

export type PayrollRunSkippedEmployee = {
  userId: string;
  fullName: string;
  email: string;
  reason: string;
};

export type PayrollRunsWorkspaceResponse = {
  company: PayrollOverviewResponse["company"];
  summary: {
    totalRuns: number;
    processedRuns: number;
    latestRunAt: string | null;
  };
  readiness: PayrollOverviewResponse["readiness"]["payroll"];
  runs: PayrollRunSummary[];
};

export type CreatePayrollRunRequest = {
  month: number;
  year: number;
};

export type PayrollRunMutationResponse = {
  message: string;
  run: PayrollRunDetail;
  skippedEmployees: PayrollRunSkippedEmployee[];
};

export type EmployeePayslipWorkspaceResponse = {
  company: PayrollOverviewResponse["company"];
  employee: PayrollRecordEmployeeSummary;
  payslips: PayrollRunDetail[];
};

export type PayrollOverviewResponse = {
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
    employeesWithOrganizationMapping: number;
    employeesWithSalaryStructure: number;
    readyEmployees: number;
    salaryStructuresConfigured: number;
  };
  readiness: {
    organization: {
      departmentsConfigured: number;
      designationsConfigured: number;
      employeesWithDepartment: number;
      employeesWithDesignation: number;
      employeesFullyMapped: number;
    };
    attendance: {
      currentDate: string;
      currentMonth: string;
      totalRecordsThisMonth: number;
      employeesWithRecordsThisMonth: number;
      openSessionsThisMonth: number;
      completedSessionsThisMonth: number;
    };
    leave: {
      totalRequests: number;
      pendingRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      employeesWithRequests: number;
    };
    payroll: {
      cycleStatus: PayrollCycleReadinessStatus;
      activeSalaryStructures: number;
      employeesMissingOrganization: number;
      employeesMissingSalaryStructure: number;
    };
  };
  employees: PayrollEmployeeFoundationEntry[];
  salaryStructures: SalaryStructureView[];
  designationOptions: PayrollDesignationOption[];
};

export type CreateSalaryStructureRequest = {
  designationId: string;
  baseAmount: number;
  currencyCode: string;
  status: SalaryStructureStatus;
};

export type UpdateSalaryStructureRequest = {
  baseAmount: number;
  currencyCode: string;
  status: SalaryStructureStatus;
};

export type CreateSalaryStructureInput = CreateSalaryStructureRequest & {
  companyId: string;
};

export type UpdateSalaryStructureInput = UpdateSalaryStructureRequest;

export type SalaryStructureMutationResponse = {
  message: string;
  salaryStructure: SalaryStructureView;
};

export type PayrollServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type PayrollServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type PayrollServiceResult<T> =
  | PayrollServiceSuccess<T>
  | PayrollServiceFailure;

export function isSalaryStructureStatus(
  value: string,
): value is SalaryStructureStatus {
  return SALARY_STRUCTURE_STATUSES.includes(value as SalaryStructureStatus);
}

export function isPayrollFoundationStatus(
  value: string,
): value is PayrollFoundationStatus {
  return PAYROLL_FOUNDATION_STATUSES.includes(value as PayrollFoundationStatus);
}

export function isPayrollRunStatus(value: string): value is PayrollRunStatus {
  return PAYROLL_RUN_STATUSES.includes(value as PayrollRunStatus);
}
