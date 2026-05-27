import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { usersRepository } from "../users/users.repository.js";
import { shiftsRepository } from "./shifts.repository.js";
import type {
  AssignShiftRequest,
  CreateShiftRequest,
  EmployeeShiftResponse,
  HrShiftWorkspaceResponse,
  ShiftAssignmentMutationResponse,
  ShiftEmployeeSummary,
  ShiftMutationResponse,
  ShiftsServiceResult,
  UpdateShiftRequest,
} from "./shifts.types.js";

function ok<T>(data: T): ShiftsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): ShiftsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function toEmployeeSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): ShiftEmployeeSummary | null {
  if (!profile || profile.role === "admin") {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email.toLowerCase(),
    role: profile.role,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function buildSummary(
  employees: readonly ShiftEmployeeSummary[],
  assignments: readonly { userId: string }[],
  totalShifts: number,
) {
  const assignedEmployeeIds = new Set(assignments.map((assignment) => assignment.userId));

  return {
    totalShifts,
    assignedEmployees: employees.filter((employee) =>
      assignedEmployeeIds.has(employee.id),
    ).length,
    unassignedEmployees: employees.filter(
      (employee) => !assignedEmployeeIds.has(employee.id),
    ).length,
    activeEmployees: employees.length,
  };
}

function resolveTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export const shiftsService = {
  async getHrWorkspace(
    user: AuthenticatedUser,
  ): Promise<ShiftsServiceResult<HrShiftWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const today = resolveTodayDate();
    const [company, shifts, assignments, profiles] = await Promise.all([
      ensureCompanyContext(user),
      shiftsRepository.listCompanyShifts(user.companyId),
      shiftsRepository.listCompanyShiftAssignments(user.companyId, today),
      usersRepository.listCompanyUserProfiles(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const employees = profiles
      .filter((profile) => profile.status === "active")
      .map(toEmployeeSummary)
      .filter((employee): employee is ShiftEmployeeSummary => employee !== null)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: buildSummary(employees, assignments, shifts.length),
      shifts,
      assignments,
      employees,
    });
  },

  async createShift(
    user: AuthenticatedUser,
    input: CreateShiftRequest,
  ): Promise<ShiftsServiceResult<ShiftMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    let shiftId: string | null = null;

    try {
      shiftId = await shiftsRepository.createShift({
        companyId: user.companyId,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        graceMinutes: input.graceMinutes,
        breakMinutes: input.breakMinutes,
        isActive: input.isActive,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A shift with this name already exists for this company.");
      }

      throw error;
    }

    if (!shiftId) {
      return fail(409, "Unable to create the shift.");
    }

    const shift = await shiftsRepository.findShiftById(user.companyId, shiftId);

    if (!shift) {
      return fail(404, "Shift not found.");
    }

    void auditService.recordAction(user, {
      action: "shift.created",
      entityType: "shift",
      entityId: shift.id,
      metadata: {
        shift,
      },
    });

    return ok({
      message: "Shift created successfully.",
      shift,
    });
  },

  async updateShift(
    user: AuthenticatedUser,
    shiftId: string,
    input: UpdateShiftRequest,
  ): Promise<ShiftsServiceResult<ShiftMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingShift = await shiftsRepository.findShiftById(
      user.companyId,
      shiftId,
    );

    if (!existingShift) {
      return fail(404, "Shift not found.");
    }

    const nextShift = {
      name: input.name ?? existingShift.name,
      startTime: input.startTime ?? existingShift.startTime,
      endTime: input.endTime ?? existingShift.endTime,
      graceMinutes: input.graceMinutes ?? existingShift.graceMinutes,
      breakMinutes: input.breakMinutes ?? existingShift.breakMinutes,
      isActive: input.isActive ?? existingShift.isActive,
    };

    if (nextShift.startTime === nextShift.endTime) {
      return fail(409, "Start time and end time cannot be the same.");
    }

    try {
      const updatedShiftId = await shiftsRepository.updateShift(
        user.companyId,
        shiftId,
        nextShift,
      );

      if (!updatedShiftId) {
        return fail(404, "Shift not found.");
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A shift with this name already exists for this company.");
      }

      throw error;
    }

    const shift = await shiftsRepository.findShiftById(user.companyId, shiftId);

    if (!shift) {
      return fail(404, "Shift not found.");
    }

    void auditService.recordAction(user, {
      action: "shift.updated",
      entityType: "shift",
      entityId: shift.id,
      metadata: {
        before: existingShift,
        after: shift,
      },
    });

    return ok({
      message: "Shift updated successfully.",
      shift,
    });
  },

  async assignShift(
    user: AuthenticatedUser,
    input: AssignShiftRequest,
  ): Promise<ShiftsServiceResult<ShiftAssignmentMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const effectiveFrom = input.effectiveFrom ?? resolveTodayDate();
    const effectiveTo = input.effectiveTo ?? null;

    if (
      effectiveTo &&
      new Date(`${effectiveTo}T00:00:00.000Z`).getTime() <
        new Date(`${effectiveFrom}T00:00:00.000Z`).getTime()
    ) {
      return fail(409, "Effective to cannot be earlier than effective from.");
    }

    const [shift, targetProfile] = await Promise.all([
      shiftsRepository.findShiftById(user.companyId, input.shiftId),
      usersRepository.findCompanyUserProfileById(user.companyId, input.userId),
    ]);

    if (!shift) {
      return fail(404, "Shift not found.");
    }

    if (!shift.isActive) {
      return fail(409, "Only active shifts can be assigned to employees.");
    }

    if (!targetProfile || targetProfile.role === "admin") {
      return fail(404, "Employee not found for this company.");
    }

    if (targetProfile.status !== "active") {
      return fail(409, "Shift can only be assigned to active employee accounts.");
    }

    const assignmentId = await shiftsRepository.assignShift({
      companyId: user.companyId,
      userId: targetProfile.id,
      shiftId: shift.id,
      effectiveFrom,
      effectiveTo,
    });

    if (!assignmentId) {
      return fail(409, "Unable to assign the shift to this employee.");
    }

    const assignment = await shiftsRepository.findEmployeeShift(
      user.companyId,
      targetProfile.id,
      effectiveFrom,
    );

    if (!assignment) {
      return fail(404, "Shift assignment not found.");
    }

    void auditService.recordAction(user, {
      action: "shift.assigned",
      entityType: "employee_shift",
      entityId: assignment.id,
      metadata: {
        employee: assignment.employee,
        shift: assignment.shift,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
      },
    });

    return ok({
      message: "Shift assigned successfully.",
      assignment,
    });
  },

  async getEmployeeShift(
    user: AuthenticatedUser,
  ): Promise<ShiftsServiceResult<EmployeeShiftResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const today = resolveTodayDate();
    const [company, profile, assignment] = await Promise.all([
      ensureCompanyContext(user),
      usersRepository.findCompanyUserProfileById(user.companyId, user.id),
      shiftsRepository.findEmployeeShift(user.companyId, user.id, today),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const employee = toEmployeeSummary(profile);

    if (!employee) {
      return fail(404, "Employee self profile not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      profile: employee,
      assignment: assignment
        ? {
            id: assignment.id,
            assignedAt: assignment.assignedAt,
            effectiveFrom: assignment.effectiveFrom,
            effectiveTo: assignment.effectiveTo,
          }
        : null,
      shift: assignment?.shift ?? null,
    });
  },
};
