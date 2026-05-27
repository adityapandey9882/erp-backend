import { withTransaction } from "../../database/index.js";
import type { DatabaseExecutor } from "../../database/query.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { attendanceRepository } from "../attendance/attendance.repository.js";
import { attendanceService } from "../attendance/attendance.service.js";
import type { AttendancePolicyContext } from "../attendance/attendance.types.js";
import { auditService } from "../audit/audit.service.js";
import {
  approvalsRepository,
  approvalsService,
  canUserActOnApprovalStep,
  resolveCurrentApprovalStep,
} from "../approvals/approvals.service.js";
import { companiesService } from "../companies/companies.service.js";
import { policiesService } from "../policies/policies.service.js";
import type { AttendancePolicySettings } from "../policies/policies.types.js";
import { shiftsRepository } from "../shifts/shifts.repository.js";
import { attendanceCorrectionsRepository } from "./attendance-corrections.repository.js";
import type {
  AttendanceCorrectionMutationResponse,
  AttendanceCorrectionRecord,
  AttendanceCorrectionsServiceResult,
  CreateAttendanceCorrectionRequest,
  EmployeeAttendanceCorrectionListResponse,
  HrAttendanceCorrectionWorkspaceResponse,
  ReviewAttendanceCorrectionRequest,
} from "./attendance-corrections.types.js";

class AttendanceCorrectionWorkflowError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "AttendanceCorrectionWorkflowError";
  }
}

function ok<T>(data: T): AttendanceCorrectionsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): AttendanceCorrectionsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function workflowFail(status: 403 | 404 | 409, message: string): never {
  throw new AttendanceCorrectionWorkflowError(status, message);
}

function isWorkflowError(error: unknown): error is AttendanceCorrectionWorkflowError {
  return error instanceof AttendanceCorrectionWorkflowError;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function resolveRequestedWindow(correction: {
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  attendance: {
    checkInAt: string | null;
    checkOutAt: string | null;
  };
}) {
  return {
    nextCheckIn: correction.requestedCheckIn ?? correction.attendance.checkInAt,
    nextCheckOut: correction.requestedCheckOut ?? correction.attendance.checkOutAt,
  };
}

function validateRequestedWindow(correction: {
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  attendance: {
    checkInAt: string | null;
    checkOutAt: string | null;
  };
}) {
  const { nextCheckIn, nextCheckOut } = resolveRequestedWindow(correction);

  if (nextCheckIn && nextCheckOut) {
    return new Date(nextCheckOut).getTime() >= new Date(nextCheckIn).getTime();
  }

  return true;
}

function buildHrSummary(items: readonly AttendanceCorrectionRecord[]) {
  return {
    totalRequests: items.length,
    pendingRequests: items.filter((item) => item.status === "pending").length,
    approvedRequests: items.filter((item) => item.status === "approved").length,
    rejectedRequests: items.filter((item) => item.status === "rejected").length,
  };
}

function buildAttendancePolicyContext(
  policy: AttendancePolicySettings,
): AttendancePolicyContext {
  return {
    allowManualEntry: policy.allowManualEntry,
    manualCorrectionAllowed: policy.allowManualEntry,
    lateThresholdMinutes: policy.lateThresholdMinutes,
    workHoursPerDay: policy.workHoursPerDay,
    workHoursReferenceMinutes: policy.workHoursReferenceMinutes,
    attendanceRoundingMode: policy.attendanceRoundingMode,
    enforcementNotes: [
      policy.allowManualEntry
        ? "Attendance correction requests are enabled and still require approval."
        : "Attendance correction requests are blocked because manual entry is disabled by company policy.",
      "Approved corrections are the only supported manual attendance mutation path.",
    ],
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

async function attachApprovalProgress(
  companyId: string,
  items: readonly AttendanceCorrectionRecord[],
) {
  return approvalsService.attachEntityApprovalProgress(
    companyId,
    "attendance-correction",
    items,
  );
}

async function resolveAttendanceRecordForCorrection(args: {
  companyId: string;
  userId: string;
  input: CreateAttendanceCorrectionRequest;
  executor: DatabaseExecutor;
}) {
  if (args.input.attendanceId) {
    const record = await attendanceCorrectionsRepository.findAttendanceRecordForUser(
      args.companyId,
      args.userId,
      args.input.attendanceId,
      args.executor,
    );

    if (!record) {
      workflowFail(404, "Attendance record not found for your account.");
    }

    if (record.attendanceDate !== args.input.attendanceDate) {
      workflowFail(
        409,
        "Attendance date does not match the selected attendance record.",
      );
    }

    return record;
  }

  const existingRecord = await attendanceRepository.findAttendanceRecordByDate(
    args.companyId,
    args.userId,
    args.input.attendanceDate,
    args.executor,
  );

  if (existingRecord) {
    return existingRecord;
  }

  return attendanceRepository.ensureAttendanceRecordForDate(
    {
      companyId: args.companyId,
      userId: args.userId,
      attendanceDate: args.input.attendanceDate,
      status: "missing",
      source: "manual",
      officeLocationId: null,
      siteLocationId: null,
      projectId: null,
      biometricDeviceId: null,
      notes: "Created from attendance regularization request.",
    },
    args.executor,
  );
}

async function applyApprovedCorrection(args: {
  companyId: string;
  correction: AttendanceCorrectionRecord;
  executor: DatabaseExecutor;
}) {
  const { nextCheckIn, nextCheckOut } = resolveRequestedWindow(args.correction);

  if (nextCheckIn === null && nextCheckOut === null) {
    workflowFail(409, "Unable to apply an empty attendance correction.");
  }

  const attendanceSettings = await attendanceRepository.getCompanyAttendanceSettings(
    args.companyId,
    args.executor,
  );

  if (!attendanceSettings) {
    workflowFail(404, "Attendance settings could not be resolved.");
  }

  const shiftAssignment = await shiftsRepository.findEmployeeShift(
    args.companyId,
    args.correction.userId,
    args.correction.attendanceDate,
  );

  const nextStatus =
    nextCheckIn && nextCheckOut
      ? attendanceService.calculateCompletedAttendanceStatus({
          attendanceDate: args.correction.attendanceDate,
          checkInAt: nextCheckIn,
          checkOutAt: nextCheckOut,
          shift: shiftAssignment?.shift
            ? {
                id: shiftAssignment.shift.id,
                name: shiftAssignment.shift.name,
                startTime: shiftAssignment.shift.startTime,
                endTime: shiftAssignment.shift.endTime,
                graceMinutes: shiftAssignment.shift.graceMinutes,
                breakMinutes: shiftAssignment.shift.breakMinutes,
                isActive: shiftAssignment.shift.isActive,
              }
            : null,
          attendanceSettings,
        })
      : nextCheckIn
        ? "checked-in"
        : "missing";

  const currentNotes = args.correction.attendance.notes?.trim() ?? "";
  const syncNote = "Approved attendance regularization.";

  return attendanceRepository.updateAttendanceRecord(
    {
      companyId: args.companyId,
      userId: args.correction.userId,
      attendanceId: args.correction.attendanceId,
      checkInAt: nextCheckIn,
      checkOutAt: nextCheckOut,
      status: nextStatus,
      source: "manual",
      officeLocationId: args.correction.attendance.locationId,
      siteLocationId: args.correction.attendance.siteLocationId,
      projectId: args.correction.attendance.projectId,
      biometricDeviceId: args.correction.attendance.deviceId,
      notes: currentNotes ? `${currentNotes}\n${syncNote}` : syncNote,
    },
    args.executor,
  );
}

export const attendanceCorrectionsService = {
  async listEmployeeCorrections(
    user: AuthenticatedUser,
  ): Promise<AttendanceCorrectionsServiceResult<EmployeeAttendanceCorrectionListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const policySettings = await policiesService.getCompanyPolicySettings(
      user.companyId,
    );
    const corrections =
      await attendanceCorrectionsRepository.listEmployeeCorrections(
        user.companyId,
        user.id,
      );

    return ok({
      policy: buildAttendancePolicyContext(policySettings.attendance),
      items: await attachApprovalProgress(user.companyId, corrections),
    });
  },

  async createEmployeeCorrection(
    user: AuthenticatedUser,
    input: CreateAttendanceCorrectionRequest,
  ): Promise<AttendanceCorrectionsServiceResult<AttendanceCorrectionMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const [company, policySettings, approvalFlow] = await Promise.all([
      ensureCompanyContext(user),
      policiesService.getCompanyPolicySettings(companyId),
      approvalsService.ensureAttendanceCorrectionFlow(companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (!policySettings.attendance.allowManualEntry) {
      return fail(
        409,
        "Attendance correction requests are disabled by company policy.",
      );
    }

    if (!approvalFlow) {
      return fail(
        409,
        "Unable to resolve the active attendance correction approval flow.",
      );
    }

    let correction: AttendanceCorrectionRecord | null = null;

    try {
      correction = await withTransaction(async (client) => {
        const attendanceRecord = await resolveAttendanceRecordForCorrection({
          companyId,
          userId: user.id,
          input,
          executor: client,
        });

        if (!attendanceRecord) {
          workflowFail(404, "Attendance record not found for your account.");
        }

        if (
          input.requestType === "full_day_missing" &&
          (attendanceRecord.checkInAt !== null || attendanceRecord.checkOutAt !== null)
        ) {
          workflowFail(
            409,
            "Full day missing requests are only available when no attendance punches exist for that date.",
          );
        }

        const nextCheckIn = input.requestedCheckIn ?? attendanceRecord.checkInAt;
        const nextCheckOut = input.requestedCheckOut ?? attendanceRecord.checkOutAt;

        if (
          nextCheckIn &&
          nextCheckOut &&
          new Date(nextCheckOut).getTime() < new Date(nextCheckIn).getTime()
        ) {
          workflowFail(409, "Requested check-out cannot be before check-in.");
        }

        const correctionId =
          await attendanceCorrectionsRepository.createCorrection(
            {
              companyId,
              userId: user.id,
              attendanceId: attendanceRecord.id,
              attendanceDate: input.attendanceDate,
              requestType: input.requestType,
              requestedCheckIn: input.requestedCheckIn,
              requestedCheckOut: input.requestedCheckOut,
              reason: input.reason,
            },
            client,
          );

        if (!correctionId) {
          workflowFail(409, "Unable to create the attendance correction request.");
        }

        const approvalRequestId = await approvalsRepository.createApprovalChainForEntity(
          client,
          "attendance-correction",
          correctionId,
          approvalFlow,
          user.id,
        );

        if (!approvalRequestId) {
          workflowFail(
            409,
            "Unable to resolve an approver for the active attendance correction approval flow.",
          );
        }

        const createdCorrection =
          await attendanceCorrectionsRepository.findCorrectionById(
            companyId,
            correctionId,
            client,
          );

        if (!createdCorrection) {
          workflowFail(404, "Attendance correction request not found.");
        }

        return createdCorrection;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "A pending correction request already exists for this attendance date.",
        );
      }

      if (isWorkflowError(error)) {
        return fail(error.status, error.message);
      }

      throw error;
    }

    if (!correction) {
      return fail(404, "Attendance correction request not found.");
    }

    const [correctionWithProgress] = await attachApprovalProgress(companyId, [
      correction,
    ]);

    void auditService.recordAction(user, {
      action: "attendance.correction.requested",
      entityType: "attendance_correction",
      entityId: correctionWithProgress.id,
      metadata: {
        attendanceDate: correctionWithProgress.attendanceDate,
        requestType: correctionWithProgress.requestType,
        attendance: correctionWithProgress.attendance,
        requestedCheckIn: correctionWithProgress.requestedCheckIn,
        requestedCheckOut: correctionWithProgress.requestedCheckOut,
        reason: correctionWithProgress.reason,
      },
    });

    return ok({
      message: "Attendance regularization request submitted successfully.",
      correction: correctionWithProgress,
    });
  },

  async listHrCorrections(
    user: AuthenticatedUser,
  ): Promise<AttendanceCorrectionsServiceResult<HrAttendanceCorrectionWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, corrections, policySettings] = await Promise.all([
      ensureCompanyContext(user),
      attendanceCorrectionsRepository.listCompanyCorrections(user.companyId),
      policiesService.getCompanyPolicySettings(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const items = await attachApprovalProgress(user.companyId, corrections);

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: buildHrSummary(items),
      policy: buildAttendancePolicyContext(policySettings.attendance),
      items,
    });
  },

  async reviewHrCorrection(
    user: AuthenticatedUser,
    correctionId: string,
    input: ReviewAttendanceCorrectionRequest,
  ): Promise<AttendanceCorrectionsServiceResult<AttendanceCorrectionMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const companyId = user.companyId;
    const existingCorrection =
      await attendanceCorrectionsRepository.findCorrectionById(
        companyId,
        correctionId,
      );

    if (!existingCorrection) {
      return fail(404, "Attendance correction request not found.");
    }

    if (existingCorrection.status !== "pending") {
      return fail(409, "Only pending attendance correction requests can be reviewed.");
    }

    const policySettings = await policiesService.getCompanyPolicySettings(companyId);

    if (!policySettings.attendance.allowManualEntry && input.status === "approved") {
      return fail(
        409,
        "Attendance correction approval is blocked because manual entry is disabled by company policy.",
      );
    }

    const currentProgress = await approvalsService.getEntityApprovalProgress(
      companyId,
      "attendance-correction",
      correctionId,
    );

    if (!currentProgress) {
      return fail(409, "The attendance correction approval flow could not be resolved.");
    }

    const currentStep = resolveCurrentApprovalStep(currentProgress);

    if (!currentStep || !canUserActOnApprovalStep(user.role, currentStep.role)) {
      return fail(
        409,
        "This attendance correction request is not currently awaiting your review.",
      );
    }

    let correction: AttendanceCorrectionRecord | null = null;
    let appliedAttendance: AttendanceCorrectionRecord["attendance"] | null = null;

    try {
      correction = await withTransaction(async (client) => {
        const lockedCorrection =
          await attendanceCorrectionsRepository.findCorrectionById(
            companyId,
            correctionId,
            client,
          );

        if (!lockedCorrection) {
          workflowFail(404, "Attendance correction request not found.");
        }

        if (lockedCorrection.status !== "pending") {
          workflowFail(
            409,
            "Only pending attendance correction requests can be reviewed.",
          );
        }

        if (!validateRequestedWindow(lockedCorrection)) {
          workflowFail(409, "Requested check-out cannot be before check-in.");
        }

        const decision = await approvalsRepository.recordApprovalDecision(client, {
          companyId,
          entityType: "attendance-correction",
          entityId: correctionId,
          stepId: currentStep.id,
          approverId: user.id,
          status: input.status,
        });

        if (!decision) {
          workflowFail(
            409,
            "This approval step could not be updated because it is no longer pending.",
          );
        }

        const updatedProgress = await approvalsRepository.getEntityApprovalProgress(
          companyId,
          "attendance-correction",
          correctionId,
          client,
        );

        const nextStatus =
          input.status === "rejected"
            ? "rejected"
            : updatedProgress?.status === "approved"
              ? "approved"
              : "pending";

        const updatedCorrectionId =
          await attendanceCorrectionsRepository.updateCorrectionStatus(
            companyId,
            correctionId,
            {
              status: nextStatus,
              approverId: nextStatus === "pending" ? null : user.id,
              approvedAt:
                nextStatus === "approved" ? new Date().toISOString() : null,
              rejectionReason:
                nextStatus === "rejected" ? input.rejectionReason ?? null : null,
            },
            client,
          );

        if (!updatedCorrectionId) {
          workflowFail(404, "Attendance correction request not found.");
        }

        if (nextStatus === "approved") {
          appliedAttendance = await applyApprovedCorrection({
            companyId,
            correction: lockedCorrection,
            executor: client,
          });

          if (!appliedAttendance) {
            workflowFail(409, "Unable to apply the attendance correction.");
          }
        }

        const updatedCorrection =
          await attendanceCorrectionsRepository.findCorrectionById(
            companyId,
            correctionId,
            client,
          );

        if (!updatedCorrection) {
          workflowFail(404, "Attendance correction request not found.");
        }

        return updatedCorrection;
      });
    } catch (error) {
      if (isWorkflowError(error)) {
        return fail(error.status, error.message);
      }

      throw error;
    }

    if (!correction) {
      return fail(404, "Attendance correction request not found.");
    }

    const [correctionWithProgress] = await attachApprovalProgress(companyId, [
      correction,
    ]);

    void auditService.recordAction(user, {
      action:
        correctionWithProgress.status === "approved"
          ? "attendance.correction.approved"
          : correctionWithProgress.status === "rejected"
            ? "attendance.correction.rejected"
            : "attendance.correction.reviewed",
      entityType: "attendance_correction",
      entityId: correctionWithProgress.id,
      metadata: {
        employee: correctionWithProgress.employee,
        decision: input.status,
        reviewRole: currentStep.role,
        requestType: correctionWithProgress.requestType,
        requestedCheckIn: correctionWithProgress.requestedCheckIn,
        requestedCheckOut: correctionWithProgress.requestedCheckOut,
        rejectionReason: input.rejectionReason ?? null,
        attendanceBeforeReview: existingCorrection.attendance,
        attendanceAfterApply: appliedAttendance,
      },
    });

    return ok({
      message:
        correctionWithProgress.status === "approved"
          ? "Attendance correction approved and applied successfully."
          : correctionWithProgress.status === "rejected"
            ? "Attendance correction rejected successfully."
            : "Attendance correction step reviewed successfully.",
      correction: correctionWithProgress,
    });
  },
};
