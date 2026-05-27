import type { AuthenticatedUser } from "../auth/auth.types.js";
import { attendanceRepository } from "../attendance/attendance.repository.js";
import { withTransaction } from "../../database/index.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import { designationsService } from "../designations/designations.service.js";
import { leaveRepository } from "../leave/leave.repository.js";
import { usersRepository } from "../users/users.repository.js";
import { payrollRepository } from "./payroll.repository.js";
import type {
  CreatePayrollRunRequest,
  CreateSalaryStructureRequest,
  EmployeePayslipWorkspaceResponse,
  PayrollRecordReference,
  PayrollCycleReadinessStatus,
  PayrollEmployeeFoundationEntry,
  PayrollOverviewResponse,
  PayrollRunDetail,
  PayrollRunMutationResponse,
  PayrollRunsWorkspaceResponse,
  PayrollRunSkippedEmployee,
  PayrollServiceResult,
  SalaryStructureMutationResponse,
  SalaryStructureView,
  UpdateSalaryStructureRequest,
} from "./payroll.types.js";
import type { AttendanceRecord } from "../attendance/attendance.types.js";
import type { LeaveRequest } from "../leave/leave.types.js";
import type { CompanyUserProfile } from "../users/users.types.js";

function ok<T>(data: T): PayrollServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): PayrollServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function sortEmployees<T extends { fullName: string }>(items: readonly T[]) {
  return [...items].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function sortDesignationOptions<T extends { title: string }>(items: readonly T[]) {
  return [...items].sort((left, right) => left.title.localeCompare(right.title));
}

function sortSalaryStructures(items: readonly SalaryStructureView[]) {
  return [...items].sort((left, right) =>
    left.designation.title.localeCompare(right.designation.title),
  );
}

function formatPeriodKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseDateOnlyMs(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function formatDateOnlyMs(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function resolvePeriodWindow(month: number, year: number) {
  const startDate = `${formatPeriodKey(month, year)}-01`;
  const endDate = formatDateOnlyMs(Date.UTC(year, month, 0));

  return {
    startDate,
    endDate,
  };
}

function calculateOverlapDays(
  itemStartDate: string,
  itemEndDate: string,
  window: { startDate: string; endDate: string },
) {
  const startMs = Math.max(
    parseDateOnlyMs(itemStartDate),
    parseDateOnlyMs(window.startDate),
  );
  const endMs = Math.min(
    parseDateOnlyMs(itemEndDate),
    parseDateOnlyMs(window.endDate),
  );

  if (endMs < startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function buildPayrollReferenceByUserId(
  month: number,
  year: number,
  attendanceRecords: readonly AttendanceRecord[],
  leaveRequests: readonly LeaveRequest[],
) {
  const periodKey = formatPeriodKey(month, year);
  const periodWindow = resolvePeriodWindow(month, year);
  const referenceByUserId = new Map<string, PayrollRecordReference>();

  function ensureReference(userId: string) {
    const current = referenceByUserId.get(userId) ?? {
      attendanceRecords: 0,
      completedAttendanceRecords: 0,
      approvedLeaveDays: 0,
    };

    referenceByUserId.set(userId, current);

    return current;
  }

  for (const record of attendanceRecords) {
    if (!record.attendanceDate.startsWith(periodKey)) {
      continue;
    }

    const reference = ensureReference(record.userId);
    reference.attendanceRecords += 1;
    reference.completedAttendanceRecords += record.checkOutAt !== null ? 1 : 0;
  }

  for (const request of leaveRequests) {
    if (request.status !== "approved") {
      continue;
    }

    const overlapDays = calculateOverlapDays(
      request.startDate,
      request.endDate,
      periodWindow,
    );

    if (overlapDays === 0) {
      continue;
    }

    const reference = ensureReference(request.userId);
    reference.approvedLeaveDays += overlapDays;
  }

  return referenceByUserId;
}

function resolveCycleStatus(
  activeEmployees: number,
  salaryStructuresConfigured: number,
  readyEmployees: number,
): PayrollCycleReadinessStatus {
  if (activeEmployees === 0 || salaryStructuresConfigured === 0 || readyEmployees === 0) {
    return "not-started";
  }

  if (readyEmployees >= activeEmployees) {
    return "ready";
  }

  return "partial";
}

async function buildOverviewWorkspace(companyId: string) {
  const [
    departments,
    designations,
    employees,
    attendanceRecords,
    leaveRequests,
    salaryStructures,
    currentDate,
  ] = await Promise.all([
    departmentsService.listCompanyDepartments(companyId),
    designationsService.listCompanyDesignations(companyId),
    usersRepository.listCompanyUserProfiles(companyId),
    attendanceRepository.listCompanyAttendanceRecords(companyId),
    leaveRepository.listCompanyLeaveRequests(companyId),
    payrollRepository.listCompanySalaryStructures(companyId),
    attendanceRepository.getCurrentDate(),
  ]);

  return buildWorkspaceData(
    currentDate,
    departments,
    designations,
    employees,
    attendanceRecords,
    leaveRequests,
    salaryStructures,
  );
}

function buildCurrencyByUserId(
  employees: readonly CompanyUserProfile[],
  salaryStructures: readonly SalaryStructureView[],
) {
  const structureByDesignationId = new Map(
    salaryStructures.map((structure) => [structure.designation.id, structure] as const),
  );
  const currencyByUserId = new Map<string, string>();

  for (const employee of employees) {
    if (!employee.designation) {
      continue;
    }

    const salaryStructure = structureByDesignationId.get(employee.designation.id);

    if (!salaryStructure) {
      continue;
    }

    currencyByUserId.set(employee.id, salaryStructure.currencyCode);
  }

  return currencyByUserId;
}

async function buildPayrollRunDetail(
  companyId: string,
  runId: string,
): Promise<PayrollRunDetail | null> {
  const run = await payrollRepository.findCompanyPayrollRunById(companyId, runId);

  if (!run) {
    return null;
  }

  const [
    recordRows,
    attendanceRecords,
    leaveRequests,
    employees,
    salaryStructures,
  ] = await Promise.all([
    payrollRepository.listPayrollRecordRowsForRun(run.id),
    attendanceRepository.listCompanyAttendanceRecords(companyId),
    leaveRepository.listCompanyLeaveRequests(companyId),
    usersRepository.listCompanyUserProfiles(companyId),
    payrollRepository.listCompanySalaryStructures(companyId),
  ]);
  const referenceByUserId = buildPayrollReferenceByUserId(
    run.month,
    run.year,
    attendanceRecords,
    leaveRequests,
  );
  const currencyByUserId = buildCurrencyByUserId(employees, salaryStructures);
  const records = recordRows
    .map((row) =>
      payrollRepository.mapPayrollRecord(
        row,
        referenceByUserId.get(row.userId) ?? {
          attendanceRecords: 0,
          completedAttendanceRecords: 0,
          approvedLeaveDays: 0,
        },
        currencyByUserId.get(row.userId) ?? "INR",
      ),
    )
    .filter((record): record is NonNullable<typeof record> => record !== null);

  return payrollRepository.buildPayrollRunDetail(run, records);
}

function resolveSkippedEmployeeReason(employee: PayrollEmployeeFoundationEntry) {
  if (employee.status !== "active") {
    return "Employee account is inactive.";
  }

  if (!employee.department || !employee.designation) {
    return "Employee is missing department or designation mapping.";
  }

  if (!employee.salaryStructure || employee.salaryStructure.status !== "active") {
    return "Employee does not have an active salary structure.";
  }

  return null;
}

function buildWorkspaceData(
  currentDate: string,
  departments: Awaited<ReturnType<typeof departmentsService.listCompanyDepartments>>,
  designations: Awaited<ReturnType<typeof designationsService.listCompanyDesignations>>,
  employees: Awaited<ReturnType<typeof usersRepository.listCompanyUserProfiles>>,
  attendanceRecords: Awaited<
    ReturnType<typeof attendanceRepository.listCompanyAttendanceRecords>
  >,
  leaveRequests: Awaited<ReturnType<typeof leaveRepository.listCompanyLeaveRequests>>,
  salaryStructures: readonly SalaryStructureView[],
): Omit<PayrollOverviewResponse, "company"> {
  const currentMonth = currentDate.slice(0, 7);
  const workforce = sortEmployees(
    employees.filter((employee) => employee.role === "employee"),
  );
  const salaryStructureByDesignationId = new Map(
    salaryStructures.map((structure) => [structure.designation.id, structure] as const),
  );

  const attendanceByUserId = new Map<
    string,
    {
      totalThisMonth: number;
      latestAttendanceDate: string | null;
    }
  >();

  for (const record of attendanceRecords) {
    if (!record.attendanceDate.startsWith(currentMonth)) {
      continue;
    }

    const current = attendanceByUserId.get(record.userId) ?? {
      totalThisMonth: 0,
      latestAttendanceDate: null,
    };

    current.totalThisMonth += 1;
    current.latestAttendanceDate =
      current.latestAttendanceDate &&
      current.latestAttendanceDate > record.attendanceDate
        ? current.latestAttendanceDate
        : record.attendanceDate;

    attendanceByUserId.set(record.userId, current);
  }

  const leaveByUserId = new Map<
    string,
    {
      totalRequests: number;
      pendingRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
    }
  >();

  for (const request of leaveRequests) {
    const current = leaveByUserId.get(request.userId) ?? {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
    };

    current.totalRequests += 1;
    current.pendingRequests += request.status === "pending" ? 1 : 0;
    current.approvedRequests += request.status === "approved" ? 1 : 0;
    current.rejectedRequests += request.status === "rejected" ? 1 : 0;
    leaveByUserId.set(request.userId, current);
  }

  const payrollEmployees = workforce.map((employee) => {
    const attendanceSummary = attendanceByUserId.get(employee.id) ?? {
      totalThisMonth: 0,
      latestAttendanceDate: null,
    };
    const leaveSummary = leaveByUserId.get(employee.id) ?? {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
    };
    const salaryStructure =
      employee.designation !== null
        ? salaryStructureByDesignationId.get(employee.designation.id) ?? null
        : null;

    let payrollFoundationStatus: PayrollEmployeeFoundationEntry["payrollFoundationStatus"] =
      "ready";

    if (employee.status !== "active") {
      payrollFoundationStatus = "inactive";
    } else if (!employee.department || !employee.designation) {
      payrollFoundationStatus = "missing-organization";
    } else if (!salaryStructure || salaryStructure.status !== "active") {
      payrollFoundationStatus = "missing-salary-structure";
    }

    return {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
      status: employee.status,
      department: employee.department,
      designation: employee.designation,
      attendanceRecordsThisMonth: attendanceSummary.totalThisMonth,
      latestAttendanceDate: attendanceSummary.latestAttendanceDate,
      leaveSummary,
      salaryStructure: salaryStructure
        ? {
            id: salaryStructure.id,
            baseAmount: salaryStructure.baseAmount,
            currencyCode: salaryStructure.currencyCode,
            status: salaryStructure.status,
            updatedAt: salaryStructure.updatedAt,
          }
        : null,
      payrollFoundationStatus,
    } satisfies PayrollEmployeeFoundationEntry;
  });

  const activeEmployees = payrollEmployees.filter(
    (employee) => employee.status === "active",
  );
  const employeesWithDepartment = payrollEmployees.filter(
    (employee) => employee.department !== null,
  ).length;
  const employeesWithDesignation = payrollEmployees.filter(
    (employee) => employee.designation !== null,
  ).length;
  const employeesFullyMapped = payrollEmployees.filter(
    (employee) => employee.department !== null && employee.designation !== null,
  ).length;
  const employeesWithSalaryStructure = payrollEmployees.filter(
    (employee) => employee.salaryStructure !== null,
  ).length;
  const readyEmployees = payrollEmployees.filter(
    (employee) => employee.payrollFoundationStatus === "ready",
  ).length;
  const employeesMissingOrganization = activeEmployees.filter(
    (employee) => employee.payrollFoundationStatus === "missing-organization",
  ).length;
  const employeesMissingSalaryStructure = activeEmployees.filter(
    (employee) => employee.payrollFoundationStatus === "missing-salary-structure",
  ).length;
  const currentMonthAttendance = attendanceRecords.filter((record) =>
    record.attendanceDate.startsWith(currentMonth),
  );

  const designationOptions = sortDesignationOptions(
    designations.map((designation) => ({
      id: designation.id,
      title: designation.title,
      code: designation.code,
      department: designation.department,
      employeeCount: payrollEmployees.filter(
        (employee) => employee.designation?.id === designation.id,
      ).length,
      hasSalaryStructure: salaryStructureByDesignationId.has(designation.id),
    })),
  );

  return {
    summary: {
      totalEmployees: payrollEmployees.length,
      activeEmployees: activeEmployees.length,
      inactiveEmployees: payrollEmployees.length - activeEmployees.length,
      employeesWithOrganizationMapping: employeesFullyMapped,
      employeesWithSalaryStructure,
      readyEmployees,
      salaryStructuresConfigured: salaryStructures.length,
    },
    readiness: {
      organization: {
        departmentsConfigured: departments.length,
        designationsConfigured: designations.length,
        employeesWithDepartment,
        employeesWithDesignation,
        employeesFullyMapped,
      },
      attendance: {
        currentDate,
        currentMonth,
        totalRecordsThisMonth: currentMonthAttendance.length,
        employeesWithRecordsThisMonth: new Set(
          currentMonthAttendance.map((record) => record.userId),
        ).size,
        openSessionsThisMonth: currentMonthAttendance.filter(
          (record) => record.status === "checked-in",
        ).length,
        completedSessionsThisMonth: currentMonthAttendance.filter(
          (record) => record.checkOutAt !== null,
        ).length,
      },
      leave: {
        totalRequests: leaveRequests.length,
        pendingRequests: leaveRequests.filter(
          (request) => request.status === "pending",
        ).length,
        approvedRequests: leaveRequests.filter(
          (request) => request.status === "approved",
        ).length,
        rejectedRequests: leaveRequests.filter(
          (request) => request.status === "rejected",
        ).length,
        employeesWithRequests: new Set(
          leaveRequests.map((request) => request.userId),
        ).size,
      },
      payroll: {
        cycleStatus: resolveCycleStatus(
          activeEmployees.length,
          salaryStructures.length,
          readyEmployees,
        ),
        activeSalaryStructures: salaryStructures.filter(
          (structure) => structure.status === "active",
        ).length,
        employeesMissingOrganization,
        employeesMissingSalaryStructure,
      },
    },
    employees: payrollEmployees,
    salaryStructures: sortSalaryStructures(salaryStructures),
    designationOptions,
  };
}

export const payrollService = {
  async getOverview(
    user: AuthenticatedUser,
  ): Promise<PayrollServiceResult<PayrollOverviewResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, workspace] = await Promise.all([
      ensureCompanyContext(user),
      buildOverviewWorkspace(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      ...workspace,
    });
  },

  async listPayrollRuns(
    user: AuthenticatedUser,
  ): Promise<PayrollServiceResult<PayrollRunsWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, runs, workspace] = await Promise.all([
      ensureCompanyContext(user),
      payrollRepository.listCompanyPayrollRuns(user.companyId),
      buildOverviewWorkspace(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: {
        totalRuns: runs.length,
        processedRuns: runs.filter((run) => run.status === "processed").length,
        latestRunAt: runs[0]?.createdAt ?? null,
      },
      readiness: workspace.readiness.payroll,
      runs,
    });
  },

  async getPayrollRun(
    user: AuthenticatedUser,
    runId: string,
  ): Promise<PayrollServiceResult<PayrollRunDetail>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const run = await buildPayrollRunDetail(user.companyId, runId);

    if (!run) {
      return fail(404, "Payroll run not found.");
    }

    return ok(run);
  },

  async runPayroll(
    user: AuthenticatedUser,
    input: CreatePayrollRunRequest,
  ): Promise<PayrollServiceResult<PayrollRunMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const [company, existingRun, workspace] = await Promise.all([
      ensureCompanyContext(user),
      payrollRepository.findCompanyPayrollRunByPeriod(
        companyId,
        input.month,
        input.year,
      ),
      buildOverviewWorkspace(companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (existingRun) {
      return fail(409, "Payroll has already been run for this period.");
    }

    const skippedEmployees: PayrollRunSkippedEmployee[] = [];
    const eligibleRecords = workspace.employees.flatMap((employee) => {
      const skippedReason = resolveSkippedEmployeeReason(employee);

      if (skippedReason) {
        skippedEmployees.push({
          userId: employee.id,
          fullName: employee.fullName,
          email: employee.email,
          reason: skippedReason,
        });
        return [];
      }

      if (!employee.salaryStructure) {
        return [];
      }

      return [
        {
          userId: employee.id,
          baseSalary: employee.salaryStructure.baseAmount,
          finalSalary: employee.salaryStructure.baseAmount,
        },
      ];
    });

    if (eligibleRecords.length === 0) {
      return fail(
        409,
        "No active employees with active salary structures are available for payroll execution.",
      );
    }

    const runId = await withTransaction(async (client) => {
      const createdRunId = await payrollRepository.createPayrollRun(
        {
          companyId,
          month: input.month,
          year: input.year,
          status: "processed",
        },
        client,
      );

      if (!createdRunId) {
        return null;
      }

      await payrollRepository.createPayrollRecords(
        eligibleRecords.map((record) => ({
          ...record,
          runId: createdRunId,
        })),
        client,
      );

      return createdRunId;
    });

    if (!runId) {
      return fail(409, "Unable to create the payroll run.");
    }

    const run = await buildPayrollRunDetail(companyId, runId);

    if (!run) {
      return fail(404, "Payroll run not found after processing.");
    }

    return ok({
      message: "Payroll run processed successfully.",
      run,
      skippedEmployees,
    });
  },

  async getEmployeePayslips(
    user: AuthenticatedUser,
  ): Promise<PayrollServiceResult<EmployeePayslipWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, employee, runs] = await Promise.all([
      ensureCompanyContext(user),
      usersRepository.findCompanyUserProfileById(user.companyId, user.id),
      payrollRepository.listCompanyPayrollRuns(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (!employee) {
      return fail(404, "Employee profile not found.");
    }

    const payslips: PayrollRunDetail[] = [];

    for (const run of runs) {
      const detail = await buildPayrollRunDetail(user.companyId, run.id);
      const employeeRecords =
        detail?.records.filter((record) => record.userId === user.id) ?? [];

      if (!detail || employeeRecords.length === 0) {
        continue;
      }

      payslips.push({
        ...detail,
        records: employeeRecords,
        employeeCount: employeeRecords.length,
        totalBaseSalary: employeeRecords.reduce(
          (total, record) => total + record.baseSalary,
          0,
        ),
        totalFinalSalary: employeeRecords.reduce(
          (total, record) => total + record.finalSalary,
          0,
        ),
      });
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        status: employee.status,
        department: employee.department,
        designation: employee.designation,
      },
      payslips,
    });
  },

  async createSalaryStructure(
    user: AuthenticatedUser,
    input: CreateSalaryStructureRequest,
  ): Promise<PayrollServiceResult<SalaryStructureMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const designation = await designationsService.findCompanyDesignationById(
      user.companyId,
      input.designationId,
    );

    if (!designation) {
      return fail(404, "Designation not found for this company.");
    }

    const existingStructure =
      await payrollRepository.findCompanySalaryStructureByDesignationId(
        user.companyId,
        input.designationId,
      );

    if (existingStructure) {
      return fail(
        409,
        "A salary structure already exists for the selected designation.",
      );
    }

    const salaryStructure = await payrollRepository.createSalaryStructure({
      companyId: user.companyId,
      designationId: input.designationId,
      baseAmount: input.baseAmount,
      currencyCode: input.currencyCode,
      status: input.status,
    });

    if (!salaryStructure) {
      return fail(404, "Unable to create salary structure.");
    }

    return ok({
      message: "Salary structure created successfully.",
      salaryStructure,
    });
  },

  async updateSalaryStructure(
    user: AuthenticatedUser,
    structureId: string,
    input: UpdateSalaryStructureRequest,
  ): Promise<PayrollServiceResult<SalaryStructureMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingStructure = await payrollRepository.findCompanySalaryStructureById(
      user.companyId,
      structureId,
    );

    if (!existingStructure) {
      return fail(404, "Salary structure not found.");
    }

    const salaryStructure = await payrollRepository.updateSalaryStructure(
      user.companyId,
      structureId,
      input,
    );

    if (!salaryStructure) {
      return fail(404, "Salary structure not found.");
    }

    return ok({
      message: "Salary structure updated successfully.",
      salaryStructure,
    });
  },
};
