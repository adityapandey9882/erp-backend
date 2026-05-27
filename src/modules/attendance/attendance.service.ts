import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { withTransaction } from "../../database/index.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { policiesService } from "../policies/policies.service.js";
import type { AttendancePolicySettings } from "../policies/policies.types.js";
import { shiftsRepository } from "../shifts/shifts.repository.js";
import type { ShiftSummary } from "../shifts/shifts.types.js";
import { usersRepository } from "../users/users.repository.js";
import { attendanceRepository } from "./attendance.repository.js";
import type {
  AttendanceLocationProof,
  AttendanceEmployeeSummary,
  AttendanceModeKey,
  AttendancePolicyContext,
  AttendancePolicyEvaluation,
  AttendanceQrAction,
  AttendanceQrSessionCancelResponse,
  AttendanceQrSessionCreateResponse,
  AttendanceQrSession,
  AttendanceQrSessionStatusResponse,
  AttendanceQrSessionVerifyResponse,
  AttendanceQrVerifiedLocation,
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceServiceResult,
  AttendanceSource,
  AttendanceVerificationSource,
  CreateAttendanceQrSessionRequest,
  EmployeeAttendanceConfig,
  EmployeeAttendanceMutationResponse,
  EmployeeAttendancePunchRequest,
  EmployeeAttendanceWorkspaceResponse,
  EmployeeOfficeLocation,
  EmployeeOfficeLocationListResponse,
  EmployeeSiteLocation,
  EmployeeSiteLocationListResponse,
  HrAttendanceEntry,
  HrAttendanceWorkspaceResponse,
  VerifyAttendanceQrSessionRequest,
} from "./attendance.types.js";

type CompanyAttendanceSettings = NonNullable<
  Awaited<ReturnType<typeof attendanceRepository.getCompanyAttendanceSettings>>
>;

type EmployeeAttendanceRuntime = {
  company: Awaited<ReturnType<typeof companiesService.getCompanyView>>;
  profileSummary: AttendanceEmployeeSummary | null;
  assignedShift: ShiftSummary | null;
  attendanceSettings: CompanyAttendanceSettings;
  policySettings: AttendancePolicySettings;
  officeLocations: EmployeeOfficeLocation[];
  siteLocations: EmployeeSiteLocation[];
  primaryOfficeLocation: EmployeeOfficeLocation | null;
  biometricDevice: Awaited<
    ReturnType<typeof attendanceRepository.findEmployeeBiometricDevice>
  >;
  currentDate: string;
};

type AttendanceValidationResult = {
  error: string | null;
  distanceMeters: number | null;
};

type ResolvedPunchContext = {
  runtime: EmployeeAttendanceRuntime;
  officeLocation: EmployeeOfficeLocation | null;
  siteLocation: EmployeeSiteLocation | null;
};

type AttendancePunchExecutionOptions = {
  proofOverride?: AttendanceLocationProof | null;
};

const ATTENDANCE_QR_EXPIRY_MINUTES = 2;
const BROWSER_GPS_FALLBACK_DISABLED_MESSAGE =
  "Browser GPS fallback is disabled. Please use Mobile QR verification.";

function ok<T>(data: T): AttendanceServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): AttendanceServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function buildQrVerifiedLocation(
  session: {
    verifiedLatitude: number | null;
    verifiedLongitude: number | null;
    verifiedAccuracyMeters: number | null;
    verifiedDistanceMeters: number | null;
  },
): AttendanceQrVerifiedLocation | null {
  if (session.verifiedLatitude === null || session.verifiedLongitude === null) {
    return null;
  }

  return {
    latitude: session.verifiedLatitude,
    longitude: session.verifiedLongitude,
    accuracyMeters: session.verifiedAccuracyMeters,
    distanceMeters: session.verifiedDistanceMeters,
  };
}

async function buildQrSessionAuthenticatedUser(
  session: AttendanceQrSession,
): Promise<AttendanceServiceResult<AuthenticatedUser>> {
  const [company, profile] = await Promise.all([
    companiesService.getCompanyView(session.companyId),
    usersRepository.findCompanyUserProfileById(
      session.companyId,
      session.employeeId,
    ),
  ]);

  if (!company || !profile) {
    return fail(404, "QR verification employee context could not be resolved.");
  }

  return ok({
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    sessionId: null,
    companyId: company.id,
    activeCompany: {
      id: company.id,
      name: company.name,
      code: company.code,
    },
    accessibleCompanies: [
      {
        id: company.id,
        name: company.name,
        code: company.code,
      },
    ],
    enabledModules: company.enabledModules,
    permissions: [],
    dashboardPath: "/dashboard/employee",
  });
}

function toEmployeeSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): AttendanceEmployeeSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
  };
}

function toShiftSummary(
  assignment: Awaited<ReturnType<typeof shiftsRepository.findEmployeeShift>> | null,
): ShiftSummary | null {
  if (!assignment) {
    return null;
  }

  return {
    id: assignment.shift.id,
    name: assignment.shift.name,
    startTime: assignment.shift.startTime,
    endTime: assignment.shift.endTime,
    graceMinutes: assignment.shift.graceMinutes,
    breakMinutes: assignment.shift.breakMinutes,
    isActive: assignment.shift.isActive,
  };
}

function buildAttendancePolicyContext(
  policy: AttendancePolicySettings,
  attendanceSettings: CompanyAttendanceSettings,
): AttendancePolicyContext {
  return {
    allowManualEntry: policy.allowManualEntry,
    manualCorrectionAllowed: policy.allowManualEntry,
    lateThresholdMinutes: attendanceSettings.graceTimeMinutes,
    workHoursPerDay: policy.workHoursPerDay,
    workHoursReferenceMinutes: policy.workHoursReferenceMinutes,
    attendanceRoundingMode: policy.attendanceRoundingMode,
    enforcementNotes: [
      policy.allowManualEntry
        ? "Attendance correction requests are enabled and still require approval."
        : "Attendance correction requests are blocked by company policy.",
      attendanceSettings.geofenceRequired
        ? "Office attendance requires a configured office location and geofence validation."
        : "Office attendance is enabled without company-level geofence enforcement.",
      attendanceSettings.remoteAttendanceAllowed
        ? "Remote attendance is enabled by company settings."
        : "Remote attendance is disabled by company settings.",
      attendanceSettings.fieldVisitAttendanceAllowed
        ? "Field visit attendance is enabled by company settings."
        : "Field visit attendance is disabled by company settings.",
    ],
  };
}

function parseDateOnlyParts(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return { year, month, day };
}

function parseTimeParts(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return {
    hours: Number(hours),
    minutes: Number(minutes),
  };
}

function buildDateTime(attendanceDate: string, timeValue: string) {
  const { year, month, day } = parseDateOnlyParts(attendanceDate);
  const { hours, minutes } = parseTimeParts(timeValue);

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

function calculateCompletedAttendanceStatus(args: {
  attendanceDate: string;
  checkInAt: string;
  checkOutAt: string;
  shift: ShiftSummary | null;
  attendanceSettings: CompanyAttendanceSettings;
}): AttendanceRecordStatus {
  const durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(args.checkOutAt).getTime() - new Date(args.checkInAt).getTime()) /
        60000,
    ),
  );
  const shiftStart = buildDateTime(
    args.attendanceDate,
    args.shift?.startTime ?? args.attendanceSettings.defaultShiftStart,
  );
  const graceMinutes =
    args.shift?.graceMinutes ?? args.attendanceSettings.graceTimeMinutes;
  const checkInTime = new Date(args.checkInAt).getTime();
  const allowedStart = shiftStart.getTime() + graceMinutes * 60000;

  if (durationMinutes < args.attendanceSettings.halfDayThresholdMinutes) {
    return "absent";
  }

  if (durationMinutes < args.attendanceSettings.fullDayThresholdMinutes) {
    return "half-day";
  }

  if (checkInTime > allowedStart) {
    return "late";
  }

  return "present";
}

function evaluateAttendancePolicy(
  record: AttendanceRecord,
  shift: ShiftSummary | null,
  policy: AttendancePolicySettings,
  attendanceSettings: CompanyAttendanceSettings,
): AttendancePolicyEvaluation {
  const notes: string[] = [];
  let lateStatus: AttendancePolicyEvaluation["lateStatus"] = "not-evaluated";
  let lateByMinutes: number | null = null;

  if (!record.checkInAt) {
    notes.push("No check-in timestamp is recorded for this attendance row.");
  } else if (!shift) {
    notes.push("No shift assignment is available for late-status calculation.");
  } else {
    const shiftStartAt = buildDateTime(record.attendanceDate, shift.startTime);
    const graceMinutes = shift.graceMinutes ?? attendanceSettings.graceTimeMinutes;
    const allowedStartAt = shiftStartAt.getTime() + graceMinutes * 60000;
    const checkInAt = new Date(record.checkInAt).getTime();
    const minutesAfterThreshold = Math.floor((checkInAt - allowedStartAt) / 60000);

    lateByMinutes = Math.max(0, minutesAfterThreshold);
    lateStatus = lateByMinutes > 0 ? "late" : "on-time";
  }

  const workDurationDeltaMinutes =
    record.durationMinutes === null
      ? null
      : record.durationMinutes - policy.workHoursReferenceMinutes;

  if (record.durationMinutes === null) {
    notes.push("Work-hours comparison is unavailable until checkout is recorded.");
  }

  if (record.status === "missing") {
    notes.push("Attendance is currently missing punch data and may require regularization.");
  }

  return {
    lateStatus,
    lateByMinutes,
    workDurationDeltaMinutes,
    notes,
  };
}

function attachAttendancePolicyEvaluation(
  record: AttendanceRecord,
  shift: ShiftSummary | null,
  policy: AttendancePolicySettings,
  attendanceSettings: CompanyAttendanceSettings,
): AttendanceRecord {
  return {
    ...record,
    policyEvaluation: evaluateAttendancePolicy(
      record,
      shift,
      policy,
      attendanceSettings,
    ),
  };
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function buildHrSummary(items: readonly HrAttendanceEntry[], currentDate: string) {
  return {
    totalRecords: items.length,
    recordsToday: items.filter((item) => item.attendanceDate === currentDate).length,
    activeEmployees: new Set(items.map((item) => item.employee.id)).size,
    openSessions: items.filter((item) => Boolean(item.checkInAt) && !item.checkOutAt)
      .length,
    completedSessions: items.filter((item) => item.checkOutAt !== null).length,
  };
}

function buildAttendanceConfig(runtime: EmployeeAttendanceRuntime): EmployeeAttendanceConfig {
  const shiftAssigned = Boolean(runtime.assignedShift);
  const officeModeBlockedReason = runtime.primaryOfficeLocation
    ? null
    : "Office location is not configured by HR/Admin.";
  const remoteAllowed = runtime.attendanceSettings.remoteAttendanceAllowed;
  const fieldVisitAllowed = runtime.attendanceSettings.fieldVisitAttendanceAllowed;
  const hasAssignedSiteLocation = runtime.siteLocations.length > 0;
  const biometricAllowed =
    runtime.biometricDevice !== null && runtime.biometricDevice.status === "online";
  const officeEnabled = shiftAssigned && officeModeBlockedReason === null;
  const remoteEnabled = shiftAssigned && remoteAllowed;
  const fieldVisitEnabled = shiftAssigned && fieldVisitAllowed && hasAssignedSiteLocation;
  const availableModes = [
    {
      key: "office" as const,
      label: "Office",
      isAllowed: true,
      isEnabled: officeEnabled,
      blockedReason: !shiftAssigned
        ? "Shift not assigned."
        : officeModeBlockedReason,
    },
    {
      key: "remote" as const,
      label: "Remote",
      isAllowed: remoteAllowed,
      isEnabled: remoteEnabled,
      blockedReason: !shiftAssigned
        ? "Shift not assigned."
        : remoteAllowed
          ? null
          : "Remote attendance is disabled by company settings.",
    },
    {
      key: "field-visit" as const,
      label: "Field Visit",
      isAllowed: fieldVisitAllowed,
      isEnabled: fieldVisitEnabled,
      blockedReason: !shiftAssigned
        ? "Shift not assigned."
        : fieldVisitAllowed
          ? hasAssignedSiteLocation
            ? null
            : "No active site location is assigned to your account."
          : "Field visit attendance is disabled by company settings.",
    },
  ];
  const anyEnabledMode =
    officeEnabled || remoteEnabled || fieldVisitEnabled || biometricAllowed;
  const checkInBlockedReason = !shiftAssigned
    ? "Shift not assigned."
    : anyEnabledMode
      ? null
      : officeModeBlockedReason ??
        "No attendance method is currently enabled for this employee.";

  return {
    officeLocation: runtime.primaryOfficeLocation,
    officeLocationsConfigured: runtime.officeLocations.length,
    shiftAssigned,
    geofenceRequired: runtime.attendanceSettings.geofenceRequired,
    allowBrowserGpsFallback: runtime.attendanceSettings.allowBrowserGpsFallback,
    breakTrackingAllowed: runtime.attendanceSettings.breakTrackingAllowed,
    allowedModes: {
      office: true,
      remote: remoteAllowed,
      fieldVisit: fieldVisitAllowed,
      biometric: biometricAllowed,
    },
    availableModes,
    biometricDevice: runtime.biometricDevice,
    officeModeBlockedReason,
    checkInBlockedReason,
  };
}

function buildEmployeeSummary(
  records: readonly AttendanceRecord[],
  currentDate: string,
  config: EmployeeAttendanceConfig,
) {
  const today = records.find((record) => record.attendanceDate === currentDate) ?? null;
  const blockedReason = today ? null : config.checkInBlockedReason;

  let currentState: EmployeeAttendanceWorkspaceResponse["summary"]["currentState"] =
    "not-started";

  if (today?.checkInAt && !today.checkOutAt) {
    currentState = "checked-in";
  } else if (today) {
    currentState = "completed";
  } else if (blockedReason) {
    currentState = "blocked";
  }

  return {
    totalRecords: records.length,
    recordsToday: today ? 1 : 0,
    completedSessions: records.filter((record) => record.checkOutAt !== null).length,
    openSessions: records.filter((record) => Boolean(record.checkInAt) && !record.checkOutAt)
      .length,
    currentState,
    canCheckIn: today === null && blockedReason === null,
    canCheckOut: Boolean(today && today.checkInAt && !today.checkOutAt),
    blockedReason,
  } as const;
}

async function buildEmployeeRuntime(
  user: AuthenticatedUser,
): Promise<EmployeeAttendanceRuntime | null> {
  if (!user.companyId) {
    return null;
  }

  const currentDate = await attendanceRepository.getCurrentDate();
  const [
    company,
    profile,
    officeLocations,
    siteLocations,
    shiftAssignment,
    attendanceSettings,
    policySettings,
  ] = await Promise.all([
    ensureCompanyContext(user),
    usersRepository.findCompanyUserProfileById(user.companyId, user.id),
    attendanceRepository.listCompanyOfficeLocations(user.companyId),
    attendanceRepository.listEmployeeSiteLocations(user.companyId, user.id),
    shiftsRepository.findEmployeeShift(user.companyId, user.id, currentDate),
    attendanceRepository.getCompanyAttendanceSettings(user.companyId),
    policiesService.getCompanyPolicySettings(user.companyId),
  ]);

  if (!attendanceSettings) {
    return null;
  }

  const profileSummary = toEmployeeSummary(profile);
  const assignedShift = toShiftSummary(shiftAssignment);
  const primaryOfficeLocation =
    officeLocations.find((office) => office.isPrimary) ?? officeLocations[0] ?? null;
  const biometricDevice = await attendanceRepository.findEmployeeBiometricDevice(
    user.companyId,
    user.id,
    primaryOfficeLocation?.id ?? null,
  );

  return {
    company,
    profileSummary,
    assignedShift,
    attendanceSettings,
    policySettings: policySettings.attendance,
    officeLocations,
    siteLocations,
    primaryOfficeLocation,
    biometricDevice,
    currentDate,
  };
}

async function buildEmployeeWorkspace(
  user: AuthenticatedUser,
): Promise<AttendanceServiceResult<EmployeeAttendanceWorkspaceResponse>> {
  if (!user.companyId) {
    return fail(403, "Your account is not assigned to a company context.");
  }

  const runtime = await buildEmployeeRuntime(user);

  if (!runtime?.company) {
    return fail(404, "Company not found.");
  }

  if (!runtime.profileSummary) {
    return fail(404, "Employee self profile not found.");
  }

  const history = await attendanceRepository.listSelfAttendanceRecords(
    user.companyId,
    user.id,
  );
  const config = buildAttendanceConfig(runtime);
  const evaluatedHistory = history.map((record) =>
    attachAttendancePolicyEvaluation(
      record,
      runtime.assignedShift,
      runtime.policySettings,
      runtime.attendanceSettings,
    ),
  );
  const summary = buildEmployeeSummary(
    evaluatedHistory,
    runtime.currentDate,
    config,
  );
  const today =
    evaluatedHistory.find(
      (record) => record.attendanceDate === runtime.currentDate,
    ) ?? null;

  return ok({
    company: {
      id: runtime.company.id,
      name: runtime.company.name,
      code: runtime.company.code,
      industry: runtime.company.industry,
      status: runtime.company.status,
    },
    profile: {
      ...runtime.profileSummary,
      shift: runtime.assignedShift,
    },
    summary,
    policy: buildAttendancePolicyContext(
      runtime.policySettings,
      runtime.attendanceSettings,
    ),
    assignedShift: runtime.assignedShift,
    config,
    today,
    history: evaluatedHistory,
  });
}

function haversineDistanceMeters(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
) {
  const earthRadius = 6371000;
  const deltaLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const deltaLng = ((end.longitude - start.longitude) * Math.PI) / 180;
  const startLat = (start.latitude * Math.PI) / 180;
  const endLat = (end.latitude * Math.PI) / 180;

  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));

  return earthRadius * arc;
}

async function resolvePunchContext(
  user: AuthenticatedUser,
  input: EmployeeAttendancePunchRequest,
): Promise<ResolvedPunchContext | null> {
  const runtime = await buildEmployeeRuntime(user);

  if (!runtime) {
    return null;
  }

  let officeLocation = runtime.primaryOfficeLocation;
  let siteLocation: EmployeeSiteLocation | null = null;

  if (input.officeLocationId) {
    officeLocation = await attendanceRepository.findOfficeLocationById(
      user.companyId as string,
      input.officeLocationId,
    );
  }

  if (input.mode === "field-visit" && input.siteLocationId) {
    siteLocation = await attendanceRepository.findAssignedSiteLocationById(
      user.companyId as string,
      user.id,
      input.siteLocationId,
    );
  }

  return {
    runtime,
    officeLocation,
    siteLocation,
  };
}

function resolveSourceForMode(
  mode: AttendanceModeKey,
  hasBiometricDevice: boolean,
): AttendanceSource {
  if (mode === "remote") {
    return "remote";
  }

  if (mode === "field-visit") {
    return "field";
  }

  return hasBiometricDevice ? "biometric" : "gps";
}

function resolveModeForAttendanceSource(source: AttendanceSource): AttendanceModeKey {
  if (source === "remote") {
    return "remote";
  }

  if (source === "field") {
    return "field-visit";
  }

  return "office";
}

function isInvalidQrCoordinate(latitude: number, longitude: number) {
  return Math.abs(latitude) < 0.05 && Math.abs(longitude) < 0.05;
}

function hashQrSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isQrSessionTokenMatch(token: string, tokenHash: string) {
  const incomingHash = Buffer.from(hashQrSessionToken(token), "hex");
  const storedHash = Buffer.from(tokenHash, "hex");

  if (incomingHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(incomingHash, storedHash);
}

function buildOfficeRadiusValidationMessage(
  distanceMeters: number,
  allowedRadiusMeters: number,
) {
  return `You are ${Math.round(
    distanceMeters,
  )}m away from office. Allowed range is ${Math.round(allowedRadiusMeters)}m.`;
}

function buildSiteRadiusValidationMessage(
  distanceMeters: number,
  allowedRadiusMeters: number,
) {
  return `You are ${Math.round(
    distanceMeters,
  )}m away from site. Allowed range is ${Math.round(allowedRadiusMeters)}m.`;
}

function buildQrAccuracyThresholdMeters(officeRadiusMeters: number | null) {
  if (officeRadiusMeters === null) {
    return 100;
  }

  return Math.max(50, Math.min(officeRadiusMeters * 2, 120));
}

function calculateOfficeDistanceForPunch(args: {
  officeLocation: EmployeeOfficeLocation | null;
  input: EmployeeAttendancePunchRequest;
}) {
  if (
    !args.officeLocation ||
    args.officeLocation.latitude === null ||
    args.officeLocation.longitude === null ||
    args.input.latitude === null ||
    args.input.longitude === null
  ) {
    return null;
  }

  return haversineDistanceMeters(
    {
      latitude: args.officeLocation.latitude,
      longitude: args.officeLocation.longitude,
    },
    {
      latitude: args.input.latitude,
      longitude: args.input.longitude,
    },
  );
}

function calculateSiteDistanceForPunch(args: {
  siteLocation: EmployeeSiteLocation | null;
  input: EmployeeAttendancePunchRequest;
}) {
  if (
    !args.siteLocation ||
    args.siteLocation.latitude === null ||
    args.siteLocation.longitude === null ||
    args.input.latitude === null ||
    args.input.longitude === null
  ) {
    return null;
  }

  return haversineDistanceMeters(
    {
      latitude: args.siteLocation.latitude,
      longitude: args.siteLocation.longitude,
    },
    {
      latitude: args.input.latitude,
      longitude: args.input.longitude,
    },
  );
}

function buildAttendanceLocationProof(args: {
  input: EmployeeAttendancePunchRequest;
  source: AttendanceSource;
  distanceMeters: number | null;
  verificationSourceOverride?: AttendanceVerificationSource | null;
}) {
  if (
    args.source === "biometric" ||
    (args.input.mode !== "office" && args.input.mode !== "field-visit") ||
    args.input.latitude === null ||
    args.input.longitude === null
  ) {
    return null;
  }

  return {
    latitude: args.input.latitude,
    longitude: args.input.longitude,
    accuracyMeters: args.input.accuracyMeters,
    distanceMeters: args.distanceMeters,
    verificationSource:
      args.verificationSourceOverride ??
      (args.input.mode === "field-visit"
        ? ("field_site_gps" satisfies AttendanceVerificationSource)
        : ("gps_verified" satisfies AttendanceVerificationSource)),
  } satisfies AttendanceLocationProof;
}

function isMobileQrPunch(options: AttendancePunchExecutionOptions) {
  return options.proofOverride?.verificationSource === "qr_mobile_gps";
}

function isDirectOfficeBrowserGpsBlocked(args: {
  runtime: EmployeeAttendanceRuntime;
  input: EmployeeAttendancePunchRequest;
  source: AttendanceSource;
  options: AttendancePunchExecutionOptions;
}) {
  return (
    args.input.mode === "office" &&
    args.source === "gps" &&
    !args.runtime.attendanceSettings.allowBrowserGpsFallback &&
    !isMobileQrPunch(args.options)
  );
}

function validatePunchAgainstConfig(args: {
  runtime: EmployeeAttendanceRuntime;
  officeLocation: EmployeeOfficeLocation | null;
  siteLocation: EmployeeSiteLocation | null;
  input: EmployeeAttendancePunchRequest;
}): AttendanceValidationResult {
  if (!args.runtime.assignedShift) {
    return {
      error: "Shift not assigned.",
      distanceMeters: null,
    };
  }

  if (args.input.mode === "remote") {
    return {
      error: args.runtime.attendanceSettings.remoteAttendanceAllowed
        ? null
        : "Remote attendance is disabled by company settings.",
      distanceMeters: null,
    };
  }

  if (args.input.mode === "field-visit") {
    if (!args.runtime.attendanceSettings.fieldVisitAttendanceAllowed) {
      return {
        error: "Field visit attendance is disabled by company settings.",
        distanceMeters: null,
      };
    }

    if (!args.input.siteLocationId) {
      return {
        error: "Select an assigned site location before marking field attendance.",
        distanceMeters: null,
      };
    }

    if (!args.siteLocation) {
      return {
        error: "Selected site location is inactive or not assigned to your account.",
        distanceMeters: null,
      };
    }

    if (
      args.siteLocation.latitude === null ||
      args.siteLocation.longitude === null ||
      args.siteLocation.geofenceRadiusMeters === null
    ) {
      return {
        error: "Selected site location does not have complete geofence coordinates.",
        distanceMeters: null,
      };
    }

    if (args.input.latitude === null || args.input.longitude === null) {
      return {
        error: "GPS coordinates are required for field site attendance.",
        distanceMeters: null,
      };
    }

    if (Math.abs(args.input.latitude) < 0.05 && Math.abs(args.input.longitude) < 0.05) {
      return {
        error: "GPS coordinates cannot point near 0,0 for field site attendance.",
        distanceMeters: null,
      };
    }

    const distanceMeters = calculateSiteDistanceForPunch(args);

    if (
      distanceMeters !== null &&
      distanceMeters > args.siteLocation.geofenceRadiusMeters
    ) {
      return {
        error: buildSiteRadiusValidationMessage(
          distanceMeters,
          args.siteLocation.geofenceRadiusMeters,
        ),
        distanceMeters,
      };
    }

    return {
      error: null,
      distanceMeters,
    };
  }

  if (!args.officeLocation) {
    return {
      error: "Office location is not configured by HR/Admin.",
      distanceMeters: null,
    };
  }

  const distanceMeters = calculateOfficeDistanceForPunch(args);

  if (
    args.runtime.attendanceSettings.geofenceRequired &&
    args.officeLocation.latitude !== null &&
    args.officeLocation.longitude !== null &&
    args.officeLocation.geofenceRadiusMeters !== null
  ) {
    if (args.input.latitude === null || args.input.longitude === null) {
      return {
        error: "GPS coordinates are required for office attendance.",
        distanceMeters: null,
      };
    }

    if (
      distanceMeters !== null &&
      distanceMeters > args.officeLocation.geofenceRadiusMeters
    ) {
      return {
        error: buildOfficeRadiusValidationMessage(
          distanceMeters,
          args.officeLocation.geofenceRadiusMeters,
        ),
        distanceMeters,
      };
    }
  }

  return {
    error: null,
    distanceMeters,
  };
}

function validateOfficeCheckOutAgainstConfig(args: {
  runtime: EmployeeAttendanceRuntime;
  officeLocation: EmployeeOfficeLocation | null;
  input: EmployeeAttendancePunchRequest;
}): AttendanceValidationResult {
  if (!args.officeLocation) {
    return {
      error: "Office location is not configured by HR/Admin.",
      distanceMeters: null,
    };
  }

  const distanceMeters = calculateOfficeDistanceForPunch(args);

  if (
    args.runtime.attendanceSettings.geofenceRequired &&
    args.officeLocation.latitude !== null &&
    args.officeLocation.longitude !== null &&
    args.officeLocation.geofenceRadiusMeters !== null
  ) {
    if (args.input.latitude === null || args.input.longitude === null) {
      return {
        error: "GPS coordinates are required for office attendance.",
        distanceMeters: null,
      };
    }

    if (
      distanceMeters !== null &&
      distanceMeters > args.officeLocation.geofenceRadiusMeters
    ) {
      return {
        error: buildOfficeRadiusValidationMessage(
          distanceMeters,
          args.officeLocation.geofenceRadiusMeters,
        ),
        distanceMeters,
      };
    }
  }

  return {
    error: null,
    distanceMeters,
  };
}

function validateSiteCheckOutAgainstConfig(args: {
  runtime: EmployeeAttendanceRuntime;
  siteLocation: EmployeeSiteLocation | null;
  input: EmployeeAttendancePunchRequest;
}): AttendanceValidationResult {
  if (!args.runtime.attendanceSettings.fieldVisitAttendanceAllowed) {
    return {
      error: "Field visit attendance is disabled by company settings.",
      distanceMeters: null,
    };
  }

  if (!args.siteLocation) {
    return {
      error: "Selected site location is inactive or not assigned to your account.",
      distanceMeters: null,
    };
  }

  if (
    args.siteLocation.latitude === null ||
    args.siteLocation.longitude === null ||
    args.siteLocation.geofenceRadiusMeters === null
  ) {
    return {
      error: "Selected site location does not have complete geofence coordinates.",
      distanceMeters: null,
    };
  }

  if (args.input.latitude === null || args.input.longitude === null) {
    return {
      error: "GPS coordinates are required for field site attendance.",
      distanceMeters: null,
    };
  }

  if (Math.abs(args.input.latitude) < 0.05 && Math.abs(args.input.longitude) < 0.05) {
    return {
      error: "GPS coordinates cannot point near 0,0 for field site attendance.",
      distanceMeters: null,
    };
  }

  const distanceMeters = calculateSiteDistanceForPunch(args);

  if (
    distanceMeters !== null &&
    distanceMeters > args.siteLocation.geofenceRadiusMeters
  ) {
    return {
      error: buildSiteRadiusValidationMessage(
        distanceMeters,
        args.siteLocation.geofenceRadiusMeters,
      ),
      distanceMeters,
    };
  }

  return {
    error: null,
    distanceMeters,
  };
}

async function runAttendanceCheckIn(
  user: AuthenticatedUser,
  input: EmployeeAttendancePunchRequest,
  options: AttendancePunchExecutionOptions = {},
): Promise<AttendanceServiceResult<EmployeeAttendanceMutationResponse>> {
  if (!user.companyId) {
    return fail(403, "Your account is not assigned to a company context.");
  }

  const profile = await usersRepository.findCompanyUserProfileById(
    user.companyId,
    user.id,
  );

  if (!profile) {
    return fail(404, "Employee self profile not found.");
  }

  const resolved = await resolvePunchContext(user, input);

  if (!resolved?.runtime) {
    return fail(404, "Attendance configuration could not be resolved.");
  }

  const source = resolveSourceForMode(
    input.mode,
    Boolean(input.deviceId && resolved.runtime.biometricDevice?.id === input.deviceId),
  );

  if (
    isDirectOfficeBrowserGpsBlocked({
      runtime: resolved.runtime,
      input,
      source,
      options,
    })
  ) {
    return fail(409, BROWSER_GPS_FALLBACK_DISABLED_MESSAGE);
  }

  const validation = validatePunchAgainstConfig({
    runtime: resolved.runtime,
    officeLocation: resolved.officeLocation,
    siteLocation: resolved.siteLocation,
    input,
  });

  if (validation.error) {
    return fail(409, validation.error);
  }

  const occurredAt = new Date().toISOString();
  const checkInProof =
    options.proofOverride ??
    buildAttendanceLocationProof({
      input,
      source,
      distanceMeters: validation.distanceMeters,
    });
  const result = await attendanceRepository.checkIn({
    companyId: user.companyId,
    userId: user.id,
    attendanceDate: resolved.runtime.currentDate,
    occurredAt,
    status: "checked-in",
    source,
    officeLocationId: input.mode === "office" ? resolved.officeLocation?.id ?? null : null,
    siteLocationId:
      input.mode === "field-visit" ? resolved.siteLocation?.id ?? null : null,
    projectId:
      input.mode === "field-visit" ? resolved.siteLocation?.projectId ?? null : null,
    biometricDeviceId:
      source === "biometric" ? resolved.runtime.biometricDevice?.id ?? null : null,
    notes: input.notes,
    checkInProof,
  });

  if (result.kind === "already-open") {
    return fail(409, "You are already checked in for today.");
  }

  if (result.kind === "already-completed") {
    return fail(409, "Attendance is already completed for today.");
  }

  const workspaceResult = await buildEmployeeWorkspace(user);

  if (!workspaceResult.ok) {
    return workspaceResult;
  }

  return ok({
    message: "Checked in successfully.",
    workspace: workspaceResult.data,
  });
}

async function runAttendanceCheckOut(
  user: AuthenticatedUser,
  input: EmployeeAttendancePunchRequest,
  options: AttendancePunchExecutionOptions = {},
): Promise<AttendanceServiceResult<EmployeeAttendanceMutationResponse>> {
  if (!user.companyId) {
    return fail(403, "Your account is not assigned to a company context.");
  }

  const profile = await usersRepository.findCompanyUserProfileById(
    user.companyId,
    user.id,
  );

  if (!profile) {
    return fail(404, "Employee self profile not found.");
  }

  const resolved = await resolvePunchContext(user, input);

  if (!resolved?.runtime) {
    return fail(404, "Attendance configuration could not be resolved.");
  }

  const todayRecord = await attendanceRepository.findAttendanceRecordByDate(
    user.companyId,
    user.id,
    resolved.runtime.currentDate,
  );

  if (!todayRecord?.checkInAt) {
    return fail(409, "You need to check in before checking out.");
  }

  const checkOutMode = resolveModeForAttendanceSource(todayRecord.source);
  const effectiveInput: EmployeeAttendancePunchRequest = {
    ...input,
    mode: checkOutMode,
    officeLocationId:
      checkOutMode === "office" ? todayRecord.locationId ?? input.officeLocationId : null,
    siteLocationId:
      checkOutMode === "field-visit"
        ? todayRecord.siteLocationId ?? input.siteLocationId
        : null,
  };
  const officeLocation =
    effectiveInput.officeLocationId !== null
      ? await attendanceRepository.findOfficeLocationById(
          user.companyId,
          effectiveInput.officeLocationId,
        )
      : resolved.runtime.primaryOfficeLocation;
  const siteLocation =
    effectiveInput.siteLocationId !== null
      ? await attendanceRepository.findAssignedSiteLocationById(
          user.companyId,
          user.id,
          effectiveInput.siteLocationId,
        )
      : null;
  const source = todayRecord.source;

  if (
    isDirectOfficeBrowserGpsBlocked({
      runtime: resolved.runtime,
      input: effectiveInput,
      source,
      options,
    })
  ) {
    return fail(409, BROWSER_GPS_FALLBACK_DISABLED_MESSAGE);
  }

  const validation =
    checkOutMode === "office"
      ? validateOfficeCheckOutAgainstConfig({
          runtime: resolved.runtime,
          officeLocation,
          input: effectiveInput,
        })
      : checkOutMode === "field-visit"
        ? validateSiteCheckOutAgainstConfig({
            runtime: resolved.runtime,
            siteLocation,
            input: effectiveInput,
          })
      : {
          error: null,
          distanceMeters: null,
        };

  if (validation.error) {
    return fail(409, validation.error);
  }

  const occurredAt = new Date().toISOString();
  const finalStatus = calculateCompletedAttendanceStatus({
    attendanceDate: resolved.runtime.currentDate,
    checkInAt: todayRecord.checkInAt,
    checkOutAt: occurredAt,
    shift: resolved.runtime.assignedShift,
    attendanceSettings: resolved.runtime.attendanceSettings,
  });
  const checkOutProof =
    options.proofOverride ??
    buildAttendanceLocationProof({
      input: effectiveInput,
      source,
      distanceMeters: validation.distanceMeters,
    });
  const result = await attendanceRepository.checkOut({
    companyId: user.companyId,
    userId: user.id,
    attendanceDate: resolved.runtime.currentDate,
    occurredAt,
    status: finalStatus,
    source,
    officeLocationId: todayRecord.locationId,
    siteLocationId: todayRecord.siteLocationId,
    projectId: todayRecord.projectId,
    biometricDeviceId: todayRecord.deviceId,
    notes: input.notes ?? todayRecord.notes,
    checkOutProof,
  });

  if (result.kind === "not-started") {
    return fail(409, "You need to check in before checking out.");
  }

  if (result.kind === "already-completed") {
    return fail(409, "You have already checked out for today.");
  }

  const workspaceResult = await buildEmployeeWorkspace(user);

  if (!workspaceResult.ok) {
    return workspaceResult;
  }

  return ok({
    message: "Checked out successfully.",
    workspace: workspaceResult.data,
  });
}

export const attendanceService = {
  async getHrWorkspace(
    user: AuthenticatedUser,
  ): Promise<AttendanceServiceResult<HrAttendanceWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const currentDate = await attendanceRepository.getCurrentDate();
    const [company, records, employees, shiftAssignments, attendanceSettings, policySettings] =
      await Promise.all([
        ensureCompanyContext(user),
        attendanceRepository.listCompanyAttendanceRecords(user.companyId),
        usersRepository.listCompanyUserProfiles(user.companyId),
        shiftsRepository.listCompanyShiftAssignments(user.companyId, currentDate),
        attendanceRepository.getCompanyAttendanceSettings(user.companyId),
        policiesService.getCompanyPolicySettings(user.companyId),
      ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (!attendanceSettings) {
      return fail(404, "Attendance settings could not be resolved.");
    }

    const hrVisibleEmployees = employees.filter(
      (employee) => employee.role !== "admin",
    );
    const employeeLookup = new Map(
      hrVisibleEmployees.map((employee) => [employee.id, toEmployeeSummary(employee)]),
    );
    const shiftLookup = new Map(
      shiftAssignments.map((assignment) => [
        assignment.userId,
        toShiftSummary(assignment),
      ]),
    );

    const items: HrAttendanceEntry[] = [];

    for (const record of records) {
      const employee = employeeLookup.get(record.userId) ?? null;

      if (!employee) {
        continue;
      }

      const shift = shiftLookup.get(record.userId) ?? null;

      items.push({
        ...attachAttendancePolicyEvaluation(
          record,
          shift,
          policySettings.attendance,
          attendanceSettings,
        ),
        employee: {
          ...employee,
          shift,
        },
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
      summary: buildHrSummary(items, currentDate),
      policy: buildAttendancePolicyContext(
        policySettings.attendance,
        attendanceSettings,
      ),
      items,
    });
  },

  getEmployeeWorkspace(user: AuthenticatedUser) {
    return buildEmployeeWorkspace(user);
  },

  async getEmployeeOfficeLocations(
    user: AuthenticatedUser,
  ): Promise<AttendanceServiceResult<EmployeeOfficeLocationListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const items = await attendanceRepository.listCompanyOfficeLocations(user.companyId);

    return ok({
      items,
    });
  },

  async getEmployeeSiteLocations(
    user: AuthenticatedUser,
  ): Promise<AttendanceServiceResult<EmployeeSiteLocationListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const items = await attendanceRepository.listEmployeeSiteLocations(
      user.companyId,
      user.id,
    );

    return ok({
      items,
    });
  },

  async checkIn(
    user: AuthenticatedUser,
    input: EmployeeAttendancePunchRequest,
  ): Promise<AttendanceServiceResult<EmployeeAttendanceMutationResponse>> {
    return runAttendanceCheckIn(user, input);
  },

  async checkOut(
    user: AuthenticatedUser,
    input: EmployeeAttendancePunchRequest,
  ): Promise<AttendanceServiceResult<EmployeeAttendanceMutationResponse>> {
    return runAttendanceCheckOut(user, input);
  },

  async createQrSession(
    user: AuthenticatedUser,
    input: CreateAttendanceQrSessionRequest,
  ): Promise<
    AttendanceServiceResult<
      Omit<AttendanceQrSessionCreateResponse, "qrUrl" | "qrCodeImage"> & {
        rawToken: string;
      }
    >
  > {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const runtime = await buildEmployeeRuntime(user);

    if (!runtime) {
      return fail(404, "Attendance configuration could not be resolved.");
    }

    const config = buildAttendanceConfig(runtime);
    const officeLocation =
      input.officeLocationId !== null
        ? await attendanceRepository.findOfficeLocationById(
            user.companyId,
            input.officeLocationId,
          )
        : runtime.primaryOfficeLocation;

    if (!runtime.assignedShift) {
      return fail(409, "Shift not assigned.");
    }

    if (!officeLocation || config.officeModeBlockedReason) {
      return fail(
        409,
        config.officeModeBlockedReason ?? "Office location is not configured by HR/Admin.",
      );
    }

    const todayRecord = await attendanceRepository.findAttendanceRecordByDate(
      user.companyId,
      user.id,
      runtime.currentDate,
    );

    if (input.action === "check_in") {
      if (todayRecord?.checkOutAt) {
        return fail(409, "Attendance is already completed for today.");
      }

      if (todayRecord?.checkInAt) {
        return fail(409, "You are already checked in for today.");
      }
    } else {
      if (!todayRecord?.checkInAt) {
        return fail(409, "You need to check in before checking out.");
      }

      if (todayRecord.checkOutAt) {
        return fail(409, "You have already checked out for today.");
      }

      if (resolveModeForAttendanceSource(todayRecord.source) !== "office") {
        return fail(
          409,
          "Mobile QR verification is available only for active office attendance sessions.",
        );
      }
    }

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + ATTENDANCE_QR_EXPIRY_MINUTES * 60_000,
    ).toISOString();
    const createdSession = await attendanceRepository.createAttendanceQrSession({
      companyId: user.companyId,
      employeeId: user.id,
      officeLocationId: officeLocation.id,
      action: input.action,
      tokenHash: hashQrSessionToken(rawToken),
      expiresAt,
    });
    const session =
      (createdSession &&
        (await attendanceRepository.findAttendanceQrSessionById(createdSession.id, {
          companyId: user.companyId,
          employeeId: user.id,
        }))) ??
      createdSession;

    if (!session) {
      return fail(404, "QR verification session could not be created.");
    }

    return ok({
      sessionId: session.id,
      action: session.action,
      status: session.status,
      expiresAt: session.expiresAt,
      rawToken,
    });
  },

  async getQrSessionStatus(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<AttendanceServiceResult<AttendanceQrSessionStatusResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    let session = await attendanceRepository.findAttendanceQrSessionById(sessionId, {
      companyId: user.companyId,
      employeeId: user.id,
    });

    if (!session) {
      return fail(404, "QR verification session not found.");
    }

    if (session.status === "pending" && new Date(session.expiresAt).getTime() <= Date.now()) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "expired",
          failureReason: session.failureReason ?? "QR verification session expired.",
        })) ?? session;
    }

    const workspace =
      session.status === "verified"
        ? await buildEmployeeWorkspace(user)
        : null;

    return ok({
      sessionId: session.id,
      action: session.action,
      status: session.status,
      expiresAt: session.expiresAt,
      verifiedAt: session.verifiedAt,
      failureReason: session.failureReason,
      officeLocation: {
        id: session.officeLocationId,
        name: session.officeLocationName,
        radiusMeters: session.officeLocationRadiusMeters,
      },
      verifiedLocation: buildQrVerifiedLocation(session),
      workspace: workspace?.ok ? workspace.data : null,
    });
  },

  async getPublicQrSessionStatus(
    sessionId: string,
    token: string,
  ): Promise<AttendanceServiceResult<AttendanceQrSessionStatusResponse>> {
    if (!token.trim()) {
      return fail(400, "QR verification token is required.");
    }

    const session = await attendanceRepository.findAttendanceQrSessionById(sessionId);

    if (!session) {
      return fail(404, "QR verification session not found.");
    }

    if (!isQrSessionTokenMatch(token, session.tokenHash as string)) {
      return fail(409, "QR verification token is invalid.");
    }

    const userResult = await buildQrSessionAuthenticatedUser(session);

    if (!userResult.ok) {
      return userResult;
    }

    return attendanceService.getQrSessionStatus(userResult.data, sessionId);
  },

  async cancelQrSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<AttendanceServiceResult<AttendanceQrSessionCancelResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return withTransaction(async (executor) => {
      let session = await attendanceRepository.lockAttendanceQrSessionById(
        sessionId,
        {
          companyId: user.companyId ?? undefined,
          employeeId: user.id,
        },
        executor,
      );

      if (!session) {
        return fail<AttendanceQrSessionCancelResponse>(
          404,
          "QR verification session not found.",
        );
      }

      if (session.status === "pending" && new Date(session.expiresAt).getTime() <= Date.now()) {
        session =
          (await attendanceRepository.updateAttendanceQrSession(
            {
              sessionId: session.id,
              companyId,
              employeeId: user.id,
              status: "expired",
              failureReason: session.failureReason ?? "QR verification session expired.",
            },
            executor,
          )) ?? session;
      }

      if (session.status !== "pending") {
        return fail<AttendanceQrSessionCancelResponse>(
          409,
          session.status === "cancelled"
            ? "QR verification session is already cancelled."
            : session.failureReason ??
                `QR verification session cannot be cancelled because it is ${session.status}.`,
        );
      }

      const cancelledSession =
        (await attendanceRepository.updateAttendanceQrSession(
          {
            sessionId: session.id,
            companyId,
            employeeId: user.id,
            status: "cancelled",
            failureReason: "QR verification session cancelled by the employee.",
          },
          executor,
        )) ?? session;

      return ok({
        message: "QR verification session cancelled.",
        sessionId: cancelledSession.id,
        status: cancelledSession.status,
      });
    });
  },

  async verifyQrSession(
    user: AuthenticatedUser,
    sessionId: string,
    input: VerifyAttendanceQrSessionRequest,
  ): Promise<AttendanceServiceResult<AttendanceQrSessionVerifyResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    let session = await attendanceRepository.findAttendanceQrSessionById(sessionId, {
      companyId: user.companyId,
      employeeId: user.id,
    });

    if (!session) {
      return fail(404, "QR verification session not found for this employee.");
    }

    if (!isQrSessionTokenMatch(input.token, session.tokenHash as string)) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          failureReason: "QR verification token is invalid.",
        })) ?? session;

      return fail(409, session.failureReason ?? "QR verification token is invalid.");
    }

    if (session.status !== "pending") {
      return fail(
        409,
        session.status === "verified"
          ? "This QR verification session has already been used."
          : session.failureReason ??
              `This QR verification session is ${session.status}.`,
      );
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "expired",
          failureReason: "QR verification session expired.",
        })) ?? session;

      return fail(409, "QR verification session expired.");
    }

    if (isInvalidQrCoordinate(input.latitude, input.longitude)) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          failureReason: "The mobile device returned an invalid location near 0,0.",
        })) ?? session;

      return fail(409, session.failureReason ?? "The mobile device returned an invalid location.");
    }

    const officeLocation = await attendanceRepository.findOfficeLocationById(
      user.companyId,
      session.officeLocationId,
    );

    if (
      !officeLocation ||
      officeLocation.latitude === null ||
      officeLocation.longitude === null ||
      officeLocation.geofenceRadiusMeters === null
    ) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          failureReason:
            "Office geofence configuration is incomplete, so QR verification could not continue.",
        })) ?? session;

      return fail(409, session.failureReason ?? "Office geofence configuration is incomplete.");
    }

    const accuracyThresholdMeters = buildQrAccuracyThresholdMeters(
      officeLocation.geofenceRadiusMeters,
    );

    if (input.accuracy > accuracyThresholdMeters) {
      const failureReason = `Mobile GPS accuracy is about ${Math.round(
        input.accuracy,
      )} meters, which is wider than the allowed verification threshold of ${Math.round(
        accuracyThresholdMeters,
      )} meters for this office.`;
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          failureReason,
          verifiedAccuracyMeters: input.accuracy,
        })) ?? session;

      return fail(409, failureReason);
    }

    const distanceMeters = haversineDistanceMeters(
      {
        latitude: officeLocation.latitude,
        longitude: officeLocation.longitude,
      },
      {
        latitude: input.latitude,
        longitude: input.longitude,
      },
    );

    if (distanceMeters > officeLocation.geofenceRadiusMeters) {
      const failureReason = buildOfficeRadiusValidationMessage(
        distanceMeters,
        officeLocation.geofenceRadiusMeters,
      );
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          verifiedLatitude: input.latitude,
          verifiedLongitude: input.longitude,
          verifiedAccuracyMeters: input.accuracy,
          verifiedDistanceMeters: distanceMeters,
          failureReason,
        })) ?? session;

      return fail(409, failureReason);
    }

    const punchPayload: EmployeeAttendancePunchRequest = {
      mode: "office",
      officeLocationId: officeLocation.id,
      siteLocationId: null,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracy,
      notes: null,
      deviceId: null,
    };
    const proofOverride: AttendanceLocationProof = {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracy,
      distanceMeters,
      verificationSource: "qr_mobile_gps",
    };
    const mutationResult =
      session.action === "check_in"
        ? await runAttendanceCheckIn(user, punchPayload, { proofOverride })
        : await runAttendanceCheckOut(user, punchPayload, { proofOverride });

    if (!mutationResult.ok) {
      session =
        (await attendanceRepository.updateAttendanceQrSession({
          sessionId: session.id,
          companyId: user.companyId,
          employeeId: user.id,
          status: "failed",
          verifiedLatitude: input.latitude,
          verifiedLongitude: input.longitude,
          verifiedAccuracyMeters: input.accuracy,
          verifiedDistanceMeters: distanceMeters,
          failureReason: mutationResult.message,
        })) ?? session;

      return mutationResult;
    }

    const verifiedSession = await attendanceRepository.updateAttendanceQrSession({
      sessionId: session.id,
      companyId: user.companyId,
      employeeId: user.id,
      status: "verified",
      attendanceRecordId: mutationResult.data.workspace.today?.id ?? null,
      verifiedAt: new Date().toISOString(),
      verifiedLatitude: input.latitude,
      verifiedLongitude: input.longitude,
      verifiedAccuracyMeters: input.accuracy,
      verifiedDistanceMeters: distanceMeters,
      failureReason: null,
    });

    return ok({
      message: mutationResult.data.message,
      status: verifiedSession?.status ?? "verified",
      distanceMeters,
      allowedRadiusMeters: officeLocation.geofenceRadiusMeters,
      accuracyMeters: input.accuracy,
      verifiedLocation: {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracy,
        distanceMeters,
      },
      workspace: mutationResult.data.workspace,
    });
  },

  async verifyPublicQrSession(
    sessionId: string,
    input: VerifyAttendanceQrSessionRequest,
  ): Promise<AttendanceServiceResult<AttendanceQrSessionVerifyResponse>> {
    const session = await attendanceRepository.findAttendanceQrSessionById(sessionId);

    if (!session) {
      return fail(404, "QR verification session not found.");
    }

    const userResult = await buildQrSessionAuthenticatedUser(session);

    if (!userResult.ok) {
      return userResult;
    }

    return attendanceService.verifyQrSession(userResult.data, sessionId, input);
  },

  calculateCompletedAttendanceStatus,
};
