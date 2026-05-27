import { appConfig } from "../../config/app.config.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { announcementsService } from "../announcements/announcements.service.js";
import {
  isHolidayVisibleToWorkLocation,
} from "../admin/admin-holiday-calendar.helpers.js";
import { adminHolidayCalendarRepository } from "../admin/admin-holiday-calendar.repository.js";
import type { HolidayCalendarItem } from "../admin/admin-holiday-calendar.types.js";
import { assetsService } from "../assets/assets.service.js";
import type { AssetEventsResponse } from "../assets/assets.types.js";
import { attendanceService } from "../attendance/attendance.service.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { leaveService } from "../leave/leave.service.js";
import { payrollService } from "../payroll/payroll.service.js";
import { ROLE_DEFINITIONS } from "../roles/roles.types.js";
import { shiftsService } from "../shifts/shifts.service.js";
import { employeeSelfRepository } from "./employee-self.repository.js";
import {
  deleteEmployeeProfilePhoto,
  readEmployeeProfilePhoto,
  storeEmployeeProfilePhoto,
} from "./employee-self.storage.js";
import type {
  CreateEmployeeAchievementRequest,
  CreateEmployeeEducationRequest,
  CreateEmployeeSkillRequest,
  CreateProfileChangeRequestRequest,
  EmployeeSelfBankDetailsMutationResponse,
  EmployeeAchievementDeleteResponse,
  EmployeeAchievementListResponse,
  EmployeeAchievementMutationResponse,
  EmployeeDashboardCalendarEvent,
  EmployeeDashboardCalendarEventStatus,
  EmployeeDashboardCalendarUpcomingResponse,
  EmployeeEducationDeleteResponse,
  EmployeeEducationListResponse,
  EmployeeEducationMutationResponse,
  EmployeeProfileChangeRequestListResponse,
  EmployeeProfileChangeRequestMutationResponse,
  EmployeeSelfAssetsResponse,
  EmployeeSelfPhotoAsset,
  EmployeeSelfPhotoMutationResponse,
  EmployeeSelfProfile,
  EmployeeSelfProfileMutationResponse,
  EmployeeSelfSettings,
  EmployeeSelfSettingsMutationResponse,
  EmployeeSelfSettingsResponse,
  EmployeeSelfOverviewResponse,
  EmployeeSelfServiceResult,
  EmployeeSkillDeleteResponse,
  EmployeeSkillListResponse,
  EmployeeSkillMutationResponse,
  UpdateEmployeeAchievementRequest,
  UpdateEmployeeSelfBankDetailsRequest,
  UpdateEmployeeEducationRequest,
  UpdateEmployeeSelfProfileRequest,
  UpdateEmployeeSelfSettingsRequest,
  UpdateEmployeeSkillRequest,
} from "./employee-self.types.js";
import type {
  AttendanceQrSessionCancelResponse,
  AttendanceQrSessionCreateResponse,
  AttendanceQrSessionStatusResponse,
  AttendanceQrSessionVerifyResponse,
  CreateAttendanceQrSessionRequest,
  EmployeeAttendanceMutationResponse,
  EmployeeAttendancePunchRequest,
  EmployeeOfficeLocationListResponse,
  EmployeeSiteLocationListResponse,
  EmployeeAttendanceWorkspaceResponse,
  VerifyAttendanceQrSessionRequest,
} from "../attendance/attendance.types.js";
import type {
  CreateEmployeeLeaveRequest,
  EmployeeLeaveMutationResponse,
  EmployeeLeaveWorkspaceResponse,
} from "../leave/leave.types.js";
import type { EmployeePayslipWorkspaceResponse } from "../payroll/payroll.types.js";
import type {
  EmployeeAnnouncementsRecentResponse,
  EmployeeAnnouncementsWorkspaceResponse,
} from "../announcements/announcements.types.js";
import type { AnnouncementRecord } from "../announcements/announcements.types.js";
import type { AttendanceRecord } from "../attendance/attendance.types.js";
import type { LeaveRequest } from "../leave/leave.types.js";

function ok<T>(data: T): EmployeeSelfServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): EmployeeSelfServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function resolveNextProfileValue<T>(currentValue: T, nextValue: T | undefined) {
  return nextValue === undefined ? currentValue : nextValue;
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function collectProfileChanges(
  currentProfile: EmployeeSelfProfile,
  input: UpdateEmployeeSelfProfileRequest,
) {
  const nextValues = {
    phone: resolveNextProfileValue(currentProfile.phone, input.phone),
    personalEmail: resolveNextProfileValue(
      currentProfile.personalEmail,
      input.personalEmail,
    ),
    emergencyContactName: resolveNextProfileValue(
      currentProfile.emergencyContactName,
      input.emergencyContactName,
    ),
    emergencyContactPhone: resolveNextProfileValue(
      currentProfile.emergencyContactPhone,
      input.emergencyContactPhone,
    ),
    address: resolveNextProfileValue(currentProfile.address, input.address),
    dateOfBirth: resolveNextProfileValue(
      currentProfile.dateOfBirth,
      input.dateOfBirth,
    ),
    gender: resolveNextProfileValue(currentProfile.gender, input.gender),
    maritalStatus: resolveNextProfileValue(
      currentProfile.maritalStatus,
      input.maritalStatus,
    ),
    bloodGroup: resolveNextProfileValue(
      currentProfile.bloodGroup,
      input.bloodGroup,
    ),
    nationality: resolveNextProfileValue(
      currentProfile.nationality,
      input.nationality,
    ),
    languages: input.languages ?? currentProfile.languages,
    bio: resolveNextProfileValue(currentProfile.bio, input.bio),
    linkedinUrl: resolveNextProfileValue(
      currentProfile.linkedinUrl,
      input.linkedinUrl,
    ),
    githubUrl: resolveNextProfileValue(currentProfile.githubUrl, input.githubUrl),
  };

  const changedFields = (
    Object.keys(nextValues) as (keyof typeof nextValues)[]
  ).filter((field) => {
    const nextValue = nextValues[field];
    const currentValue = currentProfile[field as keyof EmployeeSelfProfile];

    if (Array.isArray(nextValue) && Array.isArray(currentValue)) {
      return !areStringArraysEqual(currentValue, nextValue);
    }

    return nextValue !== currentValue;
  });

  return {
    nextValues,
    changedFields,
  };
}

function resolveNextSettingsValue<T>(currentValue: T, nextValue: T | undefined) {
  return nextValue === undefined ? currentValue : nextValue;
}

function collectSettingsChanges(
  currentSettings: EmployeeSelfSettings,
  input: UpdateEmployeeSelfSettingsRequest,
) {
  const nextValues = {
    permanentAddress: resolveNextSettingsValue(
      currentSettings.permanentAddress,
      input.permanentAddress,
    ),
    emailNotifications: resolveNextSettingsValue(
      currentSettings.emailNotifications,
      input.emailNotifications,
    ),
    marketingEmails: resolveNextSettingsValue(
      currentSettings.marketingEmails,
      input.marketingEmails,
    ),
    attendanceAlerts: resolveNextSettingsValue(
      currentSettings.attendanceAlerts,
      input.attendanceAlerts,
    ),
    leaveUpdates: resolveNextSettingsValue(
      currentSettings.leaveUpdates,
      input.leaveUpdates,
    ),
    announcementAlerts: resolveNextSettingsValue(
      currentSettings.announcementAlerts,
      input.announcementAlerts,
    ),
    payrollNotifications: resolveNextSettingsValue(
      currentSettings.payrollNotifications,
      input.payrollNotifications,
    ),
  };

  const changedFields = (
    Object.keys(nextValues) as (keyof typeof nextValues)[]
  ).filter((field) => nextValues[field] !== currentSettings[field]);

  return {
    nextValues,
    changedFields,
  };
}

function resolveNextBankDetailsValue<T>(currentValue: T, nextValue: T | undefined) {
  return nextValue === undefined ? currentValue : nextValue;
}

function collectBankDetailsChanges(
  currentBankDetails: {
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    ifsc: string | null;
    pan: string | null;
    uan: string | null;
  },
  input: UpdateEmployeeSelfBankDetailsRequest,
) {
  const nextValues = {
    bankName: resolveNextBankDetailsValue(currentBankDetails.bankName, input.bankName),
    accountHolderName: resolveNextBankDetailsValue(
      currentBankDetails.accountHolderName,
      input.accountHolderName,
    ),
    accountNumber: resolveNextBankDetailsValue(
      currentBankDetails.accountNumber,
      input.accountNumber,
    ),
    ifsc: resolveNextBankDetailsValue(currentBankDetails.ifsc, input.ifsc),
    pan: resolveNextBankDetailsValue(currentBankDetails.pan, input.pan),
    uan: resolveNextBankDetailsValue(currentBankDetails.uan, input.uan),
  };

  const changedFields = (
    Object.keys(nextValues) as (keyof typeof nextValues)[]
  ).filter((field) => nextValues[field] !== currentBankDetails[field]);

  return {
    nextValues,
    changedFields,
  };
}

function resolvePublicProfilePhotoUrl(profile: EmployeeSelfProfile) {
  if (!profile.profilePhotoUrl) {
    return null;
  }

  const profilePhotoRoute =
    profile.role === "hr" ? "/hr/profile/photo" : "/employee/profile/photo";

  return `${appConfig.apiPrefix}${profilePhotoRoute}?ts=${encodeURIComponent(
    profile.updatedAt,
  )}`;
}

function toPublicProfile(profile: EmployeeSelfProfile) {
  return {
    ...profile,
    profilePhotoUrl: resolvePublicProfilePhotoUrl(profile),
  };
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function sanitizeBankRequestChanges(input: Record<string, unknown>) {
  return {
    bankName: normalizeOptionalString(input.bankName),
    accountHolderName: normalizeOptionalString(input.accountHolderName),
    accountNumber: normalizeOptionalString(input.accountNumber),
    ifsc: normalizeOptionalString(input.ifsc)?.toUpperCase() ?? null,
    pan: normalizeOptionalString(input.pan)?.toUpperCase() ?? null,
    uan: normalizeOptionalString(input.uan) ?? null,
  };
}

function sanitizeJobRequestChanges(input: Record<string, unknown>) {
  const reportingManagerId =
    typeof input.reportingManagerId === "string" &&
    input.reportingManagerId.trim().length > 0
      ? input.reportingManagerId.trim()
      : null;
  const employmentType =
    typeof input.employmentType === "string" &&
    input.employmentType.trim().length > 0
      ? input.employmentType.trim()
      : null;

  return {
    employeeId: normalizeOptionalString(input.employeeId),
    reportingManagerId,
    workLocation: normalizeOptionalString(input.workLocation),
    employmentType,
  };
}

function dateOnlyToDate(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function dateOnlyStart(value: string) {
  return `${value}T00:00:00.000Z`;
}

function addCalendarDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function resolveAttendanceStatus(
  record: AttendanceRecord,
  workHoursReferenceMinutes: number,
): EmployeeDashboardCalendarEventStatus {
  if (record.policyEvaluation?.lateStatus === "late") {
    return "late";
  }

  if (
    record.durationMinutes !== null &&
    record.durationMinutes < workHoursReferenceMinutes / 2
  ) {
    return "half-day";
  }

  return "present";
}

function attendanceStatusTitle(status: EmployeeDashboardCalendarEventStatus) {
  if (status === "late") {
    return "Late";
  }

  if (status === "half-day") {
    return "Half Day";
  }

  return "Present";
}

function buildAttendanceCalendarEvents(
  records: readonly AttendanceRecord[],
  workHoursReferenceMinutes: number,
): EmployeeDashboardCalendarEvent[] {
  return records.map((record) => {
    const status = resolveAttendanceStatus(record, workHoursReferenceMinutes);
    const lateBy = record.policyEvaluation?.lateByMinutes ?? null;

    return {
      id: `attendance-${record.id}`,
      title: attendanceStatusTitle(status),
      type: "attendance",
      startsAt: record.checkInAt,
      endsAt: record.checkOutAt,
      location:
        status === "late" && lateBy !== null
          ? `Late by ${lateBy} minute${lateBy === 1 ? "" : "s"}`
          : "Attendance recorded",
      href: "/dashboard/employee/attendance",
      status,
      attendance: {
        attendanceDate: record.attendanceDate,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        recordStatus: record.status,
        durationMinutes: record.durationMinutes,
        lateStatus: record.policyEvaluation?.lateStatus ?? "not-evaluated",
        lateByMinutes: record.policyEvaluation?.lateByMinutes ?? null,
        workDurationDeltaMinutes:
          record.policyEvaluation?.workDurationDeltaMinutes ?? null,
        notes: record.policyEvaluation?.notes ?? [],
        updatedAt: record.updatedAt,
      },
    };
  });
}

function buildLeaveCalendarEvents(
  requests: readonly LeaveRequest[],
): EmployeeDashboardCalendarEvent[] {
  const events: EmployeeDashboardCalendarEvent[] = [];

  requests
    .filter((request) => request.status !== "rejected")
    .forEach((request) => {
      const endDate = dateOnlyToDate(request.endDate);

      for (
        let cursor = dateOnlyToDate(request.startDate);
        cursor <= endDate;
        cursor = addCalendarDays(cursor, 1)
      ) {
        const isoDate = toDateOnly(cursor);

        events.push({
          id: `leave-${request.id}-${isoDate}`,
          title: `${request.leaveType} Leave`,
          type: "leave",
          startsAt: dateOnlyStart(isoDate),
          endsAt: null,
          location:
            request.status === "approved" ? "Approved leave" : "Pending approval",
          href: "/dashboard/employee/leave",
          status: request.status,
        });
      }
    });

  return events;
}

function announcementCalendarType(announcement: AnnouncementRecord) {
  const normalized = `${announcement.title} ${announcement.content} ${announcement.category}`.toLowerCase();

  if (normalized.includes("holiday") || normalized.includes("closed")) {
    return "holiday" as const;
  }

  if (normalized.includes("meeting") || normalized.includes("review")) {
    return "meeting" as const;
  }

  return "announcement" as const;
}

function buildAnnouncementCalendarEvents(
  announcements: readonly AnnouncementRecord[],
): EmployeeDashboardCalendarEvent[] {
  return announcements.map((announcement) => ({
    id: `announcement-${announcement.id}`,
    title: announcement.title,
    type: announcementCalendarType(announcement),
    startsAt: announcement.publishedAt,
    endsAt: null,
    location: `${announcement.category} announcement`,
    href: "/dashboard/employee/announcements",
    status: announcement.priority.toLowerCase() as EmployeeDashboardCalendarEventStatus,
  }));
}

function buildHolidayCalendarEvents(
  holidays: readonly HolidayCalendarItem[],
): EmployeeDashboardCalendarEvent[] {
  return holidays
    .filter((holiday) => holiday.status === "active")
    .map((holiday) => ({
      id: `holiday-${holiday.id}`,
      title: holiday.name,
      type: "holiday",
      startsAt: dateOnlyStart(holiday.date),
      endsAt: null,
      location: holiday.office?.name ?? "Company holiday",
      href: "/dashboard/employee/calendar?filter=holiday",
      status: "scheduled",
    }));
}

function dedupeCalendarEvents(events: EmployeeDashboardCalendarEvent[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = `${event.type}:${event.id}:${event.startsAt ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function hasAnyTruthyValue(input: Record<string, unknown>) {
  return Object.values(input).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== undefined && value !== "";
  });
}

async function buildOverviewResponse(
  user: AuthenticatedUser,
  profile: EmployeeSelfProfile,
): Promise<EmployeeSelfOverviewResponse> {
  const [company, shiftResult, bankDetails, education, skills, achievements, changeRequests] =
    await Promise.all([
      companiesService.getCompanyView(user.companyId as string),
      shiftsService.getEmployeeShift(user),
      employeeSelfRepository.findSelfBankDetails(user.companyId as string, user.id),
      employeeSelfRepository.listSelfEducation(user.companyId as string, user.id),
      employeeSelfRepository.listSelfSkills(user.companyId as string, user.id),
      employeeSelfRepository.listSelfAchievements(user.companyId as string, user.id),
      employeeSelfRepository.listSelfProfileChangeRequests(
        user.companyId as string,
        user.id,
      ),
    ]);

  if (!company) {
    throw new Error("Company not found.");
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      industry: company.industry,
      status: company.status,
    },
    summary: {
      roleLabel: ROLE_DEFINITIONS[profile.role].label,
      accountStatus: profile.status,
      departmentAssigned: profile.department !== null,
      designationAssigned: profile.designation !== null,
      pendingProfileChangeRequests: changeRequests.filter(
        (request) => request.status === "pending",
      ).length,
    },
    profile: toPublicProfile(profile),
    account: {
      dashboardPath: user.dashboardPath,
      memberSince: profile.createdAt,
      lastUpdated: profile.updatedAt,
      permissions: [...user.permissions],
    },
    shift: shiftResult.ok ? shiftResult.data.shift : null,
    shiftAssignment: shiftResult.ok ? shiftResult.data.assignment : null,
    bankDetails,
    education,
    skills,
    achievements,
    changeRequests,
  };
}

export const employeeSelfService = {
  async getOverview(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfOverviewResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const profile = await employeeSelfRepository.findSelfProfile(user.companyId, user.id);

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const [shiftResult, bankDetails, education, skills, achievements, changeRequests] =
      await Promise.all([
        shiftsService.getEmployeeShift(user),
        employeeSelfRepository.findSelfBankDetails(user.companyId, user.id),
        employeeSelfRepository.listSelfEducation(user.companyId, user.id),
        employeeSelfRepository.listSelfSkills(user.companyId, user.id),
        employeeSelfRepository.listSelfAchievements(user.companyId, user.id),
        employeeSelfRepository.listSelfProfileChangeRequests(user.companyId, user.id),
      ]);

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        status: company.status,
      },
      summary: {
        roleLabel: ROLE_DEFINITIONS[profile.role].label,
        accountStatus: profile.status,
        departmentAssigned: profile.department !== null,
        designationAssigned: profile.designation !== null,
        pendingProfileChangeRequests: changeRequests.filter(
          (request) => request.status === "pending",
        ).length,
      },
      profile: toPublicProfile(profile),
      account: {
        dashboardPath: user.dashboardPath,
        memberSince: profile.createdAt,
        lastUpdated: profile.updatedAt,
        permissions: [...user.permissions],
      },
      shift: shiftResult.ok ? shiftResult.data.shift : null,
      shiftAssignment: shiftResult.ok ? shiftResult.data.assignment : null,
      bankDetails,
      education,
      skills,
      achievements,
      changeRequests,
    });
  },

  getAttendanceWorkspace(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeAttendanceWorkspaceResponse>> {
    return attendanceService.getEmployeeWorkspace(user);
  },

  getOfficeLocations(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeOfficeLocationListResponse>> {
    return attendanceService.getEmployeeOfficeLocations(user);
  },

  getSiteLocations(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeSiteLocationListResponse>> {
    return attendanceService.getEmployeeSiteLocations(user);
  },

  getAssetsWorkspace(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfAssetsResponse>> {
    return assetsService.getEmployeeWorkspace(user);
  },

  getAssetEvents(
    user: AuthenticatedUser,
    assetId: string,
  ): Promise<EmployeeSelfServiceResult<AssetEventsResponse>> {
    return assetsService.getEmployeeAssetEvents(user, assetId);
  },

  checkIn(
    user: AuthenticatedUser,
    input: EmployeeAttendancePunchRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeAttendanceMutationResponse>> {
    return attendanceService.checkIn(user, input);
  },

  checkOut(
    user: AuthenticatedUser,
    input: EmployeeAttendancePunchRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeAttendanceMutationResponse>> {
    return attendanceService.checkOut(user, input);
  },

  createAttendanceQrSession(
    user: AuthenticatedUser,
    input: CreateAttendanceQrSessionRequest,
  ): Promise<
    EmployeeSelfServiceResult<
      Omit<AttendanceQrSessionCreateResponse, "qrUrl" | "qrCodeImage"> & {
        rawToken: string;
      }
    >
  > {
    return attendanceService.createQrSession(user, input);
  },

  getAttendanceQrSessionStatus(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<EmployeeSelfServiceResult<AttendanceQrSessionStatusResponse>> {
    return attendanceService.getQrSessionStatus(user, sessionId);
  },

  cancelAttendanceQrSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<EmployeeSelfServiceResult<AttendanceQrSessionCancelResponse>> {
    return attendanceService.cancelQrSession(user, sessionId);
  },

  verifyAttendanceQrSession(
    user: AuthenticatedUser,
    sessionId: string,
    input: VerifyAttendanceQrSessionRequest,
  ): Promise<EmployeeSelfServiceResult<AttendanceQrSessionVerifyResponse>> {
    return attendanceService.verifyQrSession(user, sessionId, input);
  },

  getLeaveWorkspace(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeLeaveWorkspaceResponse>> {
    return leaveService.getEmployeeWorkspace(user);
  },

  async getUpcomingCalendar(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeDashboardCalendarUpcomingResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [attendanceResult, leaveResult, announcementsResult, profile, holidays] =
      await Promise.all([
        attendanceService.getEmployeeWorkspace(user),
        leaveService.getEmployeeWorkspace(user),
        announcementsService.getEmployeeAnnouncements(user),
        employeeSelfRepository.findSelfProfile(user.companyId, user.id),
        adminHolidayCalendarRepository.listHolidays(user.companyId),
      ]);

    if (!attendanceResult.ok) {
      return fail(attendanceResult.status, attendanceResult.message);
    }

    if (!leaveResult.ok) {
      return fail(leaveResult.status, leaveResult.message);
    }

    if (!announcementsResult.ok) {
      return fail(announcementsResult.status, announcementsResult.message);
    }

    const visibleHolidays = holidays.filter((holiday) =>
      isHolidayVisibleToWorkLocation(holiday, profile?.workLocation ?? null),
    );
    const items = dedupeCalendarEvents([
      ...buildAttendanceCalendarEvents(
        attendanceResult.data.history,
        attendanceResult.data.policy.workHoursReferenceMinutes,
      ),
      ...buildLeaveCalendarEvents(leaveResult.data.items),
      ...buildHolidayCalendarEvents(visibleHolidays),
      ...buildAnnouncementCalendarEvents(announcementsResult.data.items),
    ]).sort((left, right) => {
      const leftDate = left.startsAt ?? left.endsAt ?? "";
      const rightDate = right.startsAt ?? right.endsAt ?? "";

      return leftDate.localeCompare(rightDate);
    });

    return ok({
      items,
    });
  },

  requestLeave(
    user: AuthenticatedUser,
    input: CreateEmployeeLeaveRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeLeaveMutationResponse>> {
    return leaveService.requestLeave(user, input);
  },

  getPayslips(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeePayslipWorkspaceResponse>> {
    return payrollService.getEmployeePayslips(user);
  },

  getAnnouncements(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeAnnouncementsWorkspaceResponse>> {
    return announcementsService.getEmployeeAnnouncements(user);
  },

  getRecentAnnouncements(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeAnnouncementsRecentResponse>> {
    return announcementsService.getEmployeeRecentAnnouncements(user, 3);
  },

  markAnnouncementSeen(user: AuthenticatedUser, announcementId: string) {
    return announcementsService.markEmployeeAnnouncementSeen(user, announcementId);
  },

  acknowledgeAnnouncement(user: AuthenticatedUser, announcementId: string) {
    return announcementsService.acknowledgeEmployeeAnnouncement(user, announcementId);
  },

  updateAnnouncementImportance(
    user: AuthenticatedUser,
    announcementId: string,
    input: unknown,
  ) {
    return announcementsService.updateEmployeeAnnouncementImportance(
      user,
      announcementId,
      input,
    );
  },

  async updateProfile(
    user: AuthenticatedUser,
    input: UpdateEmployeeSelfProfileRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfProfileMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingProfile = await employeeSelfRepository.findSelfProfile(
      user.companyId,
      user.id,
    );

    if (!existingProfile) {
      return fail(404, "Employee self profile not found.");
    }

    const { nextValues, changedFields } = collectProfileChanges(
      existingProfile,
      input,
    );

    if (changedFields.length === 0) {
      return fail(409, "No profile changes were provided.");
    }

    const updatedProfile = await employeeSelfRepository.updateSelfProfile(
      user.companyId,
      user.id,
      nextValues,
    );

    if (!updatedProfile) {
      return fail(404, "Employee self profile not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.updated",
      entityType: "user",
      entityId: updatedProfile.id,
      metadata: {
        updatedFields: changedFields,
        before: Object.fromEntries(
          changedFields.map((field) => [field, existingProfile[field]]),
        ),
        after: Object.fromEntries(
          changedFields.map((field) => [field, updatedProfile[field]]),
        ),
      },
    });

    return ok({
      message: "Profile updated successfully.",
      profile: toPublicProfile(updatedProfile),
    });
  },

  async uploadProfilePhoto(
    user: AuthenticatedUser,
    asset: EmployeeSelfPhotoAsset,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfPhotoMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingProfile = await employeeSelfRepository.findSelfProfile(
      user.companyId,
      user.id,
    );

    if (!existingProfile) {
      return fail(404, "Employee self profile not found.");
    }

    const storedPhoto = await storeEmployeeProfilePhoto({
      companyId: user.companyId,
      userId: user.id,
      fileName: asset.fileName,
      fileMimeType: asset.mimeType,
      fileBuffer: asset.fileBuffer,
    });

    const updatedProfile = await employeeSelfRepository.updateSelfProfilePhoto(
      user.companyId,
      user.id,
      storedPhoto.storageReference,
    );

    if (!updatedProfile) {
      return fail(404, "Employee self profile not found.");
    }

    if (
      existingProfile.profilePhotoUrl &&
      existingProfile.profilePhotoUrl !== storedPhoto.storageReference
    ) {
      void deleteEmployeeProfilePhoto(existingProfile.profilePhotoUrl).catch(() => {});
    }

    void auditService.recordAction(user, {
      action: "employee.profile.photo.updated",
      entityType: "user",
      entityId: updatedProfile.id,
      metadata: {
        storageMethod: storedPhoto.storageMethod,
      },
    });

    return ok({
      message: "Profile photo updated successfully.",
      profile: toPublicProfile(updatedProfile),
    });
  },

  async getProfilePhoto(
    user: AuthenticatedUser,
  ): Promise<
    EmployeeSelfServiceResult<{
      buffer: Buffer;
      mimeType: string;
    }>
  > {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const profile = await employeeSelfRepository.findSelfProfile(user.companyId, user.id);

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    if (!profile.profilePhotoUrl) {
      return fail(404, "Profile photo not found.");
    }

    const photo = await readEmployeeProfilePhoto(profile.profilePhotoUrl);

    return ok(photo);
  },

  async getSettings(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfSettingsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const profile = await employeeSelfRepository.findSelfProfile(user.companyId, user.id);

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    const settings = await employeeSelfRepository.findSelfSettings(user.id);

    return ok({
      settings,
    });
  },

  async updateSettings(
    user: AuthenticatedUser,
    input: UpdateEmployeeSelfSettingsRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfSettingsMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const profile = await employeeSelfRepository.findSelfProfile(user.companyId, user.id);

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    const existingSettings = await employeeSelfRepository.findSelfSettings(user.id);
    const { nextValues, changedFields } = collectSettingsChanges(existingSettings, input);

    if (changedFields.length === 0) {
      return fail(409, "No settings changes were provided.");
    }

    const updatedSettings = await employeeSelfRepository.upsertSelfSettings(
      user.id,
      nextValues,
    );

    void auditService.recordAction(user, {
      action: "employee.settings.updated",
      entityType: "user_settings",
      entityId: user.id,
      metadata: {
        updatedFields: changedFields,
        before: Object.fromEntries(
          changedFields.map((field) => [field, existingSettings[field]]),
        ),
        after: Object.fromEntries(
          changedFields.map((field) => [field, updatedSettings[field]]),
        ),
      },
    });

    return ok({
      message: "Settings updated successfully.",
      settings: updatedSettings,
    });
  },

  async updateBankDetails(
    user: AuthenticatedUser,
    input: UpdateEmployeeSelfBankDetailsRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeSelfBankDetailsMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const profile = await employeeSelfRepository.findSelfProfile(user.companyId, user.id);

    if (!profile) {
      return fail(404, "Employee self profile not found.");
    }

    const existingBankDetails =
      (await employeeSelfRepository.findSelfBankDetailsForUpdate(
        user.companyId,
        user.id,
      )) ?? {
        bankName: null,
        accountHolderName: null,
        accountNumber: null,
        ifsc: null,
        pan: null,
        uan: null,
      };

    const { nextValues, changedFields } = collectBankDetailsChanges(
      existingBankDetails,
      input,
    );

    if (changedFields.length === 0) {
      return fail(409, "No bank detail changes were provided.");
    }

    const updatedBankDetails = await employeeSelfRepository.upsertEmployeeBankDetails(
      user.companyId,
      user.id,
      {
        ...nextValues,
        verifiedBy: null,
      },
    );

    void auditService.recordAction(user, {
      action: "employee.bank-details.updated",
      entityType: "employee_bank_details",
      entityId: user.id,
      metadata: {
        updatedFields: changedFields,
        initiatedByRole: user.role,
      },
    });

    return ok({
      message: "Bank details updated successfully.",
      bankDetails: updatedBankDetails,
    });
  },

  async listEducation(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeEducationListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return ok({
      items: await employeeSelfRepository.listSelfEducation(user.companyId, user.id),
    });
  },

  async createEducation(
    user: AuthenticatedUser,
    input: CreateEmployeeEducationRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeEducationMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const education = await employeeSelfRepository.createEducation(
      user.companyId,
      user.id,
      {
        degree: input.degree,
        institution: input.institution,
        fieldOfStudy: input.fieldOfStudy ?? null,
        startYear: input.startYear ?? null,
        endYear: input.endYear ?? null,
        grade: input.grade ?? null,
        description: input.description ?? null,
      },
    );

    if (!education) {
      return fail(404, "Employee self profile not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.education.created",
      entityType: "employee_education",
      entityId: education.id,
      metadata: {
        degree: education.degree,
      },
    });

    return ok({
      message: "Education record added successfully.",
      education,
    });
  },

  async updateEducation(
    user: AuthenticatedUser,
    educationId: string,
    input: UpdateEmployeeEducationRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeEducationMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = (
      await employeeSelfRepository.listSelfEducation(user.companyId, user.id)
    ).find((record) => record.id === educationId);

    if (!existing) {
      return fail(404, "Education record not found.");
    }

    const updated = await employeeSelfRepository.updateEducation(
      user.companyId,
      user.id,
      educationId,
      {
        degree: input.degree ?? existing.degree,
        institution: input.institution ?? existing.institution,
        fieldOfStudy:
          input.fieldOfStudy === undefined
            ? existing.fieldOfStudy
            : input.fieldOfStudy,
        startYear:
          input.startYear === undefined ? existing.startYear : input.startYear,
        endYear: input.endYear === undefined ? existing.endYear : input.endYear,
        grade: input.grade === undefined ? existing.grade : input.grade,
        description:
          input.description === undefined ? existing.description : input.description,
      },
    );

    if (!updated) {
      return fail(404, "Education record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.education.updated",
      entityType: "employee_education",
      entityId: updated.id,
    });

    return ok({
      message: "Education record updated successfully.",
      education: updated,
    });
  },

  async deleteEducation(
    user: AuthenticatedUser,
    educationId: string,
  ): Promise<EmployeeSelfServiceResult<EmployeeEducationDeleteResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const deleted = await employeeSelfRepository.deleteEducation(
      user.companyId,
      user.id,
      educationId,
    );

    if (!deleted) {
      return fail(404, "Education record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.education.deleted",
      entityType: "employee_education",
      entityId: educationId,
    });

    return ok({
      message: "Education record deleted successfully.",
      deletedEducationId: educationId,
    });
  },

  async listSkills(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeSkillListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return ok({
      items: await employeeSelfRepository.listSelfSkills(user.companyId, user.id),
    });
  },

  async createSkill(
    user: AuthenticatedUser,
    input: CreateEmployeeSkillRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeSkillMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const skill = await employeeSelfRepository.createSkill(user.companyId, user.id, {
      name: input.name,
      category: input.category ?? null,
      proficiency: input.proficiency ?? null,
    });

    if (!skill) {
      return fail(404, "Employee self profile not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.skill.created",
      entityType: "employee_skills",
      entityId: skill.id,
      metadata: {
        name: skill.name,
      },
    });

    return ok({
      message: "Skill added successfully.",
      skill,
    });
  },

  async updateSkill(
    user: AuthenticatedUser,
    skillId: string,
    input: UpdateEmployeeSkillRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeSkillMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = (
      await employeeSelfRepository.listSelfSkills(user.companyId, user.id)
    ).find((record) => record.id === skillId);

    if (!existing) {
      return fail(404, "Skill record not found.");
    }

    const updated = await employeeSelfRepository.updateSkill(
      user.companyId,
      user.id,
      skillId,
      {
        name: input.name ?? existing.name,
        category: input.category === undefined ? existing.category : input.category,
        proficiency:
          input.proficiency === undefined
            ? existing.proficiency
            : input.proficiency,
      },
    );

    if (!updated) {
      return fail(404, "Skill record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.skill.updated",
      entityType: "employee_skills",
      entityId: updated.id,
    });

    return ok({
      message: "Skill updated successfully.",
      skill: updated,
    });
  },

  async deleteSkill(
    user: AuthenticatedUser,
    skillId: string,
  ): Promise<EmployeeSelfServiceResult<EmployeeSkillDeleteResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const deleted = await employeeSelfRepository.deleteSkill(
      user.companyId,
      user.id,
      skillId,
    );

    if (!deleted) {
      return fail(404, "Skill record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.skill.deleted",
      entityType: "employee_skills",
      entityId: skillId,
    });

    return ok({
      message: "Skill deleted successfully.",
      deletedSkillId: skillId,
    });
  },

  async listAchievements(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeAchievementListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return ok({
      items: await employeeSelfRepository.listSelfAchievements(
        user.companyId,
        user.id,
      ),
    });
  },

  async createAchievement(
    user: AuthenticatedUser,
    input: CreateEmployeeAchievementRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeAchievementMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const achievement = await employeeSelfRepository.createAchievement(
      user.companyId,
      user.id,
      {
        title: input.title,
        issuer: input.issuer ?? null,
        achievedAt: input.achievedAt ?? null,
        credentialUrl: input.credentialUrl ?? null,
        description: input.description ?? null,
      },
    );

    if (!achievement) {
      return fail(404, "Employee self profile not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.achievement.created",
      entityType: "employee_achievements",
      entityId: achievement.id,
      metadata: {
        title: achievement.title,
      },
    });

    return ok({
      message: "Achievement added successfully.",
      achievement,
    });
  },

  async updateAchievement(
    user: AuthenticatedUser,
    achievementId: string,
    input: UpdateEmployeeAchievementRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeAchievementMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = (
      await employeeSelfRepository.listSelfAchievements(user.companyId, user.id)
    ).find((record) => record.id === achievementId);

    if (!existing) {
      return fail(404, "Achievement record not found.");
    }

    const updated = await employeeSelfRepository.updateAchievement(
      user.companyId,
      user.id,
      achievementId,
      {
        title: input.title ?? existing.title,
        issuer: input.issuer === undefined ? existing.issuer : input.issuer,
        achievedAt:
          input.achievedAt === undefined ? existing.achievedAt : input.achievedAt,
        credentialUrl:
          input.credentialUrl === undefined
            ? existing.credentialUrl
            : input.credentialUrl,
        description:
          input.description === undefined ? existing.description : input.description,
      },
    );

    if (!updated) {
      return fail(404, "Achievement record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.achievement.updated",
      entityType: "employee_achievements",
      entityId: updated.id,
    });

    return ok({
      message: "Achievement updated successfully.",
      achievement: updated,
    });
  },

  async deleteAchievement(
    user: AuthenticatedUser,
    achievementId: string,
  ): Promise<EmployeeSelfServiceResult<EmployeeAchievementDeleteResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const deleted = await employeeSelfRepository.deleteAchievement(
      user.companyId,
      user.id,
      achievementId,
    );

    if (!deleted) {
      return fail(404, "Achievement record not found.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.achievement.deleted",
      entityType: "employee_achievements",
      entityId: achievementId,
    });

    return ok({
      message: "Achievement deleted successfully.",
      deletedAchievementId: achievementId,
    });
  },

  async listProfileChangeRequests(
    user: AuthenticatedUser,
  ): Promise<EmployeeSelfServiceResult<EmployeeProfileChangeRequestListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return ok({
      items: await employeeSelfRepository.listSelfProfileChangeRequests(
        user.companyId,
        user.id,
      ),
    });
  },

  async createProfileChangeRequest(
    user: AuthenticatedUser,
    input: CreateProfileChangeRequestRequest,
  ): Promise<EmployeeSelfServiceResult<EmployeeProfileChangeRequestMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const hasPendingRequest = await employeeSelfRepository.findPendingProfileChangeRequest(
      user.companyId,
      user.id,
      input.requestType,
    );

    if (hasPendingRequest) {
      return fail(
        409,
        "A pending request of the same type is already waiting for HR review.",
      );
    }

    const normalizedChanges =
      input.requestType === "bank-details"
        ? sanitizeBankRequestChanges(input.requestedChanges)
        : sanitizeJobRequestChanges(input.requestedChanges);

    if (!hasAnyTruthyValue(normalizedChanges)) {
      return fail(400, "Requested changes are empty after validation.");
    }

    if (input.requestType === "job-information") {
      const jobChanges = sanitizeJobRequestChanges(input.requestedChanges);

      if (jobChanges.reportingManagerId) {
        if (jobChanges.reportingManagerId === user.id) {
          return fail(
            400,
            "Reporting manager cannot be the employee account itself.",
          );
        }

        const manager = await employeeSelfRepository.findCompanyUserActorSummary(
          user.companyId,
          jobChanges.reportingManagerId,
        );

        if (!manager) {
          return fail(404, "Reporting manager was not found for this company.");
        }
      }
    }

    const request = await employeeSelfRepository.createProfileChangeRequest(
      user.companyId,
      user.id,
      {
        requestType: input.requestType,
        requestedChanges: normalizedChanges,
        reason: input.reason ?? null,
      },
    );

    if (!request) {
      return fail(404, "Profile change request could not be created.");
    }

    void auditService.recordAction(user, {
      action: "employee.profile.change-request.created",
      entityType: "profile_change_requests",
      entityId: request.id,
      metadata: {
        requestType: request.requestType,
      },
    });

    return ok({
      message: "Profile change request submitted successfully.",
      request,
    });
  },
};
