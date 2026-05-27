import { appConfig } from "../../config/app.config.js";
import { withTransaction } from "../../database/index.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import { designationsService } from "../designations/designations.service.js";
import { usersService } from "../users/users.service.js";
import { attendanceRepository } from "../attendance/attendance.repository.js";
import { attendanceService } from "../attendance/attendance.service.js";
import { attendanceCorrectionsService } from "../attendance-corrections/attendance-corrections.service.js";
import { adminHolidayCalendarRepository } from "../admin/admin-holiday-calendar.repository.js";
import { adminHolidayCalendarService } from "../admin/admin-holiday-calendar.service.js";
import { adminSettingsRepository } from "../admin/admin-settings.repository.js";
import { announcementsService } from "../announcements/announcements.service.js";
import { auditService } from "../audit/audit.service.js";
import { leaveService } from "../leave/leave.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { offboardingService } from "../offboarding/offboarding.service.js";
import { onboardingService } from "../onboarding/onboarding.service.js";
import { payrollService } from "../payroll/payroll.service.js";
import { shiftsService } from "../shifts/shifts.service.js";
import {
  employeeSelfRepository,
} from "../employee-self/employee-self.repository.js";
import {
  isEmployeeProfileEmploymentType,
  type ReviewProfileChangeRequestRequest,
} from "../employee-self/employee-self.types.js";
import { hrRepository } from "./hr.repository.js";
import type {
  AdminHolidayCalendarWorkspaceResponse,
  CreateHolidayRequest,
  HolidayMutationResponse,
  UpdateHolidayRequest,
} from "../admin/admin-holiday-calendar.types.js";
import type {
  HrEmployeeProfile,
  HrEmployeeDetailResponse,
  HrEmployeeDirectoryResponse,
  HrEmployeeImportFailure,
  HrEmployeeImportResponse,
  HrEmployeeMutationResponse,
  ImportHrEmployeesRequest,
  HrOverviewResponse,
  HrProfileChangeRequestDetailResponse,
  HrProfileChangeRequestReviewResponse,
  HrServiceResult,
  ReviewHrProfileChangeRequestRequest,
  UpdateHrEmployeeProfileRequest,
} from "./hr.types.js";
import { validateCreateCompanyUserPayload } from "../users/users.validation.js";
import type { HrAttendanceWorkspaceResponse } from "../attendance/attendance.types.js";
import type {
  HrLeaveMutationResponse,
  HrLeaveWorkspaceResponse,
  UpdateHrLeaveStatusRequest,
} from "../leave/leave.types.js";
import type {
  CreateOffboardingRequest,
  OffboardingMutationResponse,
  OffboardingWorkspaceResponse,
  ReviewOffboardingRequest,
} from "../offboarding/offboarding.types.js";
import { buildHrDashboardOverview } from "./hr-dashboard.js";

function ok<T>(data: T): HrServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(status: 400 | 403 | 404 | 409, message: string): HrServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function summarizeEmployees(
  employees: Awaited<ReturnType<typeof hrRepository.listCompanyEmployeeProfiles>>,
  roleDistribution: Awaited<
    ReturnType<typeof hrRepository.getCompanyEmployeeRoleSummary>
  >,
) {
  return {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((employee) => employee.status === "active")
      .length,
    inactiveEmployees: employees.filter(
      (employee) => employee.status === "inactive",
    ).length,
    mappedDepartments: employees.filter((employee) => employee.department !== null)
      .length,
    mappedDesignations: employees.filter(
      (employee) => employee.designation !== null,
    ).length,
    rolesInUse: roleDistribution.filter((role) => role.totalUsers > 0).length,
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

async function resolveEmployeeOrganizationAssignment(
  companyId: string,
  input: UpdateHrEmployeeProfileRequest,
) {
  const department =
    input.departmentId !== undefined && input.departmentId !== null
      ? await departmentsService.findCompanyDepartmentById(
          companyId,
          input.departmentId,
        )
      : null;

  if (input.departmentId && !department) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Department not found for this company.",
    };
  }

  const designation =
    input.designationId !== undefined && input.designationId !== null
      ? await designationsService.findCompanyDesignationById(
          companyId,
          input.designationId,
        )
      : null;

  if (input.designationId && !designation) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Designation not found for this company.",
    };
  }

  const designationDepartmentId = designation?.department?.id ?? null;

  if (
    department &&
    designationDepartmentId &&
    designationDepartmentId !== department.id
  ) {
    return {
      ok: false as const,
      status: 409 as const,
      message:
        "The selected designation belongs to a different department for this company.",
    };
  }

  return {
    ok: true as const,
    data: {
      departmentId: designationDepartmentId ?? department?.id ?? null,
      designationId: designation?.id ?? null,
    },
  };
}

function normalizeOptionalRequestString(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function summarizeProfileChangeRequests(
  items: HrProfileChangeRequestDetailResponse["items"],
) {
  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => item.status === "pending").length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
    cancelledRequests: items.filter((item) => item.status === "cancelled").length,
  };
}

function validateApprovedEmploymentType(value: unknown) {
  const employmentType = normalizeOptionalRequestString(value);

  if (employmentType === undefined) {
    return {
      ok: false as const,
      message: "Employment type in the request payload is invalid.",
    };
  }

  if (
    employmentType !== null &&
    !isEmployeeProfileEmploymentType(employmentType)
  ) {
    return {
      ok: false as const,
      message: "Employment type in the request payload is invalid.",
    };
  }

  return {
    ok: true as const,
    value: employmentType,
  };
}

function resolveCompanyProfilePhotoUrl(
  profile: Pick<HrEmployeeProfile, "id" | "updatedAt" | "profilePhotoUrl">,
) {
  if (!profile.profilePhotoUrl) {
    return null;
  }

  return `${appConfig.apiPrefix}/hr/employees/${encodeURIComponent(
    profile.id,
  )}/profile/photo?ts=${encodeURIComponent(profile.updatedAt)}`;
}

function toPublicHrEmployeeProfile(profile: HrEmployeeProfile): HrEmployeeProfile {
  return {
    ...profile,
    profilePhotoUrl: resolveCompanyProfilePhotoUrl(profile),
  };
}

export const hrService = {
  async getOverview(user: AuthenticatedUser): Promise<HrServiceResult<HrOverviewResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, employeeProfiles, roleDistribution, departments, designations] =
      await Promise.all([
        ensureCompanyContext(user),
        hrRepository.listCompanyEmployeeProfiles(user.companyId),
        hrRepository.getCompanyEmployeeRoleSummary(user.companyId),
        departmentsService.listCompanyDepartments(user.companyId),
        designationsService.listCompanyDesignations(user.companyId),
      ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const employees = employeeProfiles.map(toPublicHrEmployeeProfile);

    const [
      attendanceWorkspaceResult,
      leaveWorkspaceResult,
      shiftsWorkspaceResult,
      onboardingWorkspaceResult,
      offboardingWorkspaceResult,
      payrollOverviewResult,
      notificationsWorkspaceResult,
      announcementsWorkspaceResult,
      attendanceCorrectionsWorkspaceResult,
      currentDate,
      attendanceSettings,
      payrollSettings,
      biometricDevices,
      holidays,
    ] = await Promise.all([
      attendanceService.getHrWorkspace(user),
      leaveService.getHrWorkspace(user),
      shiftsService.getHrWorkspace(user),
      onboardingService.getWorkspace(user),
      offboardingService.getWorkspace(user),
      payrollService.getOverview(user),
      notificationsService.getWorkspace(user),
      announcementsService.getManagementWorkspace(user),
      attendanceCorrectionsService.listHrCorrections(user),
      attendanceRepository.getCurrentDate(),
      adminSettingsRepository.getAttendanceSettings(user.companyId),
      adminSettingsRepository.getPayrollSettings(user.companyId),
      adminSettingsRepository.listBiometricDevices(user.companyId),
      adminHolidayCalendarRepository.listHolidays(user.companyId),
    ]);

    if (!attendanceWorkspaceResult.ok) {
      return fail(attendanceWorkspaceResult.status, attendanceWorkspaceResult.message);
    }

    if (!leaveWorkspaceResult.ok) {
      return fail(leaveWorkspaceResult.status, leaveWorkspaceResult.message);
    }

    if (!shiftsWorkspaceResult.ok) {
      return fail(shiftsWorkspaceResult.status, shiftsWorkspaceResult.message);
    }

    if (!onboardingWorkspaceResult.ok) {
      return fail(onboardingWorkspaceResult.status, onboardingWorkspaceResult.message);
    }

    if (!offboardingWorkspaceResult.ok) {
      return fail(offboardingWorkspaceResult.status, offboardingWorkspaceResult.message);
    }

    if (!payrollOverviewResult.ok) {
      return fail(payrollOverviewResult.status, payrollOverviewResult.message);
    }

    if (!notificationsWorkspaceResult.ok) {
      return fail(
        notificationsWorkspaceResult.status,
        notificationsWorkspaceResult.message,
      );
    }

    if (!announcementsWorkspaceResult.ok) {
      return fail(
        announcementsWorkspaceResult.status as 403 | 404 | 409,
        announcementsWorkspaceResult.message,
      );
    }

    if (!attendanceCorrectionsWorkspaceResult.ok) {
      return fail(
        attendanceCorrectionsWorkspaceResult.status,
        attendanceCorrectionsWorkspaceResult.message,
      );
    }

    if (!attendanceSettings || !payrollSettings) {
      return fail(
        404,
        "Required company attendance or payroll settings could not be resolved.",
      );
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: summarizeEmployees(employees, roleDistribution),
      roleDistribution,
      organization: {
        departments,
        designations,
      },
      dashboard: buildHrDashboardOverview({
        employees,
        currentDate,
        attendanceWorkspace: attendanceWorkspaceResult.data,
        leaveWorkspace: leaveWorkspaceResult.data,
        shiftsWorkspace: shiftsWorkspaceResult.data,
        onboardingWorkspace: onboardingWorkspaceResult.data,
        offboardingWorkspace: offboardingWorkspaceResult.data,
        payrollOverview: payrollOverviewResult.data,
        notificationsWorkspace: notificationsWorkspaceResult.data,
        announcementsWorkspace: announcementsWorkspaceResult.data,
        attendanceCorrectionsWorkspace: attendanceCorrectionsWorkspaceResult.data,
        attendanceSettings,
        payrollSettings,
        biometricDevices,
        holidays,
      }),
    });
  },

  getAttendanceWorkspace(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<HrAttendanceWorkspaceResponse>> {
    return attendanceService.getHrWorkspace(user);
  },

  getLeaveWorkspace(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<HrLeaveWorkspaceResponse>> {
    return leaveService.getHrWorkspace(user);
  },

  async getHolidayCalendarWorkspace(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<AdminHolidayCalendarWorkspaceResponse>> {
    const result = await adminHolidayCalendarService.getWorkspace(user);

    if (!result.ok) {
      return fail(result.status, result.message);
    }

    return ok(result.data);
  },

  async createHoliday(
    user: AuthenticatedUser,
    input: CreateHolidayRequest,
  ): Promise<HrServiceResult<HolidayMutationResponse>> {
    const result = await adminHolidayCalendarService.createHoliday(user, input);

    if (!result.ok) {
      return fail(result.status, result.message);
    }

    return ok(result.data);
  },

  async updateHoliday(
    user: AuthenticatedUser,
    holidayId: string,
    input: UpdateHolidayRequest,
  ): Promise<HrServiceResult<HolidayMutationResponse>> {
    const result = await adminHolidayCalendarService.updateHoliday(
      user,
      holidayId,
      input,
    );

    if (!result.ok) {
      return fail(result.status, result.message);
    }

    return ok(result.data);
  },

  async getEmployeeDirectory(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<HrEmployeeDirectoryResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      items: (
        await hrRepository.listCompanyEmployeeProfiles(user.companyId)
      ).map(toPublicHrEmployeeProfile),
    });
  },

  async getEmployeeDetail(
    user: AuthenticatedUser,
    targetUserId: string,
  ): Promise<HrServiceResult<HrEmployeeDetailResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const employee = await hrRepository.findCompanyEmployeeProfileById(
      user.companyId,
      targetUserId,
    );

    if (!employee) {
      return fail(404, "Employee profile not found.");
    }

    return ok({
      employee: toPublicHrEmployeeProfile(employee),
    });
  },

  async importEmployees(
    user: AuthenticatedUser,
    input: ImportHrEmployeesRequest,
  ): Promise<HrServiceResult<HrEmployeeImportResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!input.rows.length) {
      return fail(400, "Import payload must include at least one employee row.");
    }

    const failures: HrEmployeeImportFailure[] = [];
    const createdUserIds: string[] = [];

    for (const row of input.rows) {
      const validation = validateCreateCompanyUserPayload(row);

      if (!validation.success) {
        failures.push({
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          email: row.email,
          message: validation.errors.join(" "),
        });
        continue;
      }

      const creationResult = await usersService.createCompanyUser(
        user,
        validation.data,
      );

      if (!creationResult.ok) {
        failures.push({
          rowNumber: row.rowNumber,
          fullName: validation.data.fullName,
          email: validation.data.email,
          message: creationResult.message,
        });
        continue;
      }

      createdUserIds.push(creationResult.data.user.id);
    }

    const importedEmployees = (
      await Promise.all(
        createdUserIds.map((userId) =>
          hrRepository.findCompanyEmployeeProfileById(user.companyId as string, userId),
        ),
      )
    ).filter((employee): employee is NonNullable<typeof employee> => employee !== null);

    const importedCount = importedEmployees.length;
    const failedCount = failures.length;

    return ok({
      message:
        importedCount > 0
          ? failedCount > 0
            ? `${importedCount} employee${importedCount === 1 ? "" : "s"} imported successfully. ${failedCount} row${failedCount === 1 ? "" : "s"} failed.`
            : `${importedCount} employee${importedCount === 1 ? "" : "s"} imported successfully.`
          : "No employee rows were imported.",
      importedCount,
      failedCount,
      employees: importedEmployees.map(toPublicHrEmployeeProfile),
      failures,
    });
  },

  async updateEmployeeProfile(
    user: AuthenticatedUser,
    targetUserId: string,
    input: UpdateHrEmployeeProfileRequest,
  ): Promise<HrServiceResult<HrEmployeeMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingEmployee = await hrRepository.findCompanyEmployeeProfileById(
      user.companyId,
      targetUserId,
    );

    if (!existingEmployee) {
      return fail(404, "Employee profile not found.");
    }

    const resolvedAssignment = await resolveEmployeeOrganizationAssignment(
      user.companyId,
      input,
    );

    if (!resolvedAssignment.ok) {
      return fail(resolvedAssignment.status, resolvedAssignment.message);
    }

    const updatedEmployee = await hrRepository.updateCompanyEmployeeProfile(
      user.companyId,
      targetUserId,
      resolvedAssignment.data,
    );

    if (!updatedEmployee) {
      return fail(404, "Employee profile not found.");
    }

    return ok({
      message: "Employee profile updated successfully.",
      employee: toPublicHrEmployeeProfile(updatedEmployee),
    });
  },

  async listProfileChangeRequests(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<HrProfileChangeRequestDetailResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const items = await employeeSelfRepository.listCompanyProfileChangeRequests(
      user.companyId,
    );

    return ok({
      items,
      summary: summarizeProfileChangeRequests(items),
    });
  },

  async reviewProfileChangeRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ReviewHrProfileChangeRequestRequest,
  ): Promise<HrServiceResult<HrProfileChangeRequestReviewResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingRequest = await employeeSelfRepository.findProfileChangeRequestById(
      user.companyId,
      requestId,
    );

    if (!existingRequest) {
      return fail(404, "Profile change request not found.");
    }

    if (existingRequest.status !== "pending") {
      return fail(409, "Only pending profile change requests can be reviewed.");
    }

    if (input.status === "approved" && existingRequest.requestType === "job-information") {
      const currentProfile = await employeeSelfRepository.findSelfProfile(
        user.companyId,
        existingRequest.userId,
      );

      if (!currentProfile) {
        return fail(404, "Employee profile not found for this request.");
      }

      const employmentTypeValidation = validateApprovedEmploymentType(
        existingRequest.requestedChanges.employmentType,
      );

      if (!employmentTypeValidation.ok) {
        return fail(409, employmentTypeValidation.message);
      }

      const requestedManagerId = normalizeOptionalRequestString(
        existingRequest.requestedChanges.reportingManagerId,
      );

      if (requestedManagerId === undefined) {
        return fail(409, "Reporting manager in the request payload is invalid.");
      }

      if (requestedManagerId && requestedManagerId === existingRequest.userId) {
        return fail(409, "Reporting manager cannot match the employee account.");
      }

      if (requestedManagerId) {
        const manager = await employeeSelfRepository.findCompanyUserActorSummary(
          user.companyId,
          requestedManagerId,
        );

        if (!manager) {
          return fail(404, "Reporting manager not found for this company.");
        }
      }

      void currentProfile;
    }

    const reviewedRequest = await withTransaction(async (executor) => {
      if (input.status === "approved") {
        if (existingRequest.requestType === "bank-details") {
          const existingBankDetails =
            await employeeSelfRepository.findSelfBankDetailsForUpdate(
              user.companyId as string,
              existingRequest.userId,
              executor,
            );

          const bankName = normalizeOptionalRequestString(
            existingRequest.requestedChanges.bankName,
          );
          const accountHolderName = normalizeOptionalRequestString(
            existingRequest.requestedChanges.accountHolderName,
          );
          const accountNumber = normalizeOptionalRequestString(
            existingRequest.requestedChanges.accountNumber,
          );
          const ifsc = normalizeOptionalRequestString(
            existingRequest.requestedChanges.ifsc,
          );
          const pan = normalizeOptionalRequestString(
            existingRequest.requestedChanges.pan,
          );
          const uan = normalizeOptionalRequestString(
            existingRequest.requestedChanges.uan,
          );

          await employeeSelfRepository.upsertEmployeeBankDetails(
            user.companyId as string,
            existingRequest.userId,
            {
              bankName:
                bankName === undefined
                  ? existingBankDetails?.bankName ?? null
                  : bankName,
              accountHolderName:
                accountHolderName === undefined
                  ? existingBankDetails?.accountHolderName ?? null
                  : accountHolderName,
              accountNumber:
                accountNumber === undefined
                  ? existingBankDetails?.accountNumber ?? null
                  : accountNumber,
              ifsc:
                ifsc === undefined
                  ? existingBankDetails?.ifsc ?? null
                  : ifsc?.toUpperCase() ?? null,
              pan:
                pan === undefined
                  ? existingBankDetails?.pan ?? null
                  : pan?.toUpperCase() ?? null,
              uan: uan === undefined ? existingBankDetails?.uan ?? null : uan,
              verifiedBy: user.id,
            },
            executor,
          );
        }

        if (existingRequest.requestType === "job-information") {
          const currentProfile = await employeeSelfRepository.findSelfProfile(
            user.companyId as string,
            existingRequest.userId,
            executor,
          );

          if (!currentProfile) {
            throw new Error("Employee profile not found for this request.");
          }

          const employmentTypeValidation = validateApprovedEmploymentType(
            existingRequest.requestedChanges.employmentType,
          );

          if (!employmentTypeValidation.ok) {
            throw new Error(employmentTypeValidation.message);
          }

          const employeeId = normalizeOptionalRequestString(
            existingRequest.requestedChanges.employeeId,
          );
          const reportingManagerId = normalizeOptionalRequestString(
            existingRequest.requestedChanges.reportingManagerId,
          );
          const workLocation = normalizeOptionalRequestString(
            existingRequest.requestedChanges.workLocation,
          );

          await employeeSelfRepository.updateApprovedJobInformation(
            user.companyId as string,
            existingRequest.userId,
            {
              employeeId:
                employeeId === undefined ? currentProfile.employeeId : employeeId,
              reportingManagerId:
                reportingManagerId === undefined
                  ? currentProfile.reportingManager?.id ?? null
                  : reportingManagerId,
              workLocation:
                workLocation === undefined
                  ? currentProfile.workLocation
                  : workLocation,
              employmentType:
                employmentTypeValidation.value === undefined
                  ? currentProfile.employmentType
                  : employmentTypeValidation.value,
            },
            executor,
          );
        }
      }

      return employeeSelfRepository.reviewProfileChangeRequest(
        user.companyId as string,
        requestId,
        {
          status: input.status,
          reviewNotes: input.reviewNotes ?? null,
          reviewedBy: user.id,
        },
        executor,
      );
    });

    if (!reviewedRequest) {
      return fail(
        409,
        "Profile change request could not be reviewed because it is no longer pending.",
      );
    }

    void auditService.recordAction(user, {
      action:
        input.status === "approved"
          ? "hr.profile-change-request.approved"
          : "hr.profile-change-request.rejected",
      entityType: "profile_change_requests",
      entityId: reviewedRequest.id,
      metadata: {
        requestType: reviewedRequest.requestType,
        employeeId: reviewedRequest.userId,
      },
    });

    return ok({
      message:
        input.status === "approved"
          ? "Profile change request approved successfully."
          : "Profile change request rejected successfully.",
      request: reviewedRequest,
    });
  },

  updateLeaveStatus(
    user: AuthenticatedUser,
    leaveId: string,
    input: UpdateHrLeaveStatusRequest,
  ): Promise<HrServiceResult<HrLeaveMutationResponse>> {
    return leaveService.reviewLeave(user, leaveId, input);
  },

  getOffboardingWorkspace(
    user: AuthenticatedUser,
  ): Promise<HrServiceResult<OffboardingWorkspaceResponse>> {
    return offboardingService.getWorkspace(user);
  },

  createOffboardingRequest(
    user: AuthenticatedUser,
    input: CreateOffboardingRequest,
  ): Promise<HrServiceResult<OffboardingMutationResponse>> {
    return offboardingService.createRequest(user, input);
  },

  reviewOffboardingRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: ReviewOffboardingRequest,
  ): Promise<HrServiceResult<OffboardingMutationResponse>> {
    return offboardingService.reviewRequest(user, requestId, input);
  },

  completeOffboardingRequest(
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<HrServiceResult<OffboardingMutationResponse>> {
    return offboardingService.completeRequest(user, requestId);
  },
};
