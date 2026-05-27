import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { withTransaction } from "../../database/index.js";
import { attendanceRepository } from "../attendance/attendance.repository.js";
import { attendanceService } from "../attendance/attendance.service.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { policiesService } from "../policies/policies.service.js";
import { shiftsRepository } from "../shifts/shifts.repository.js";
import { superadminSettingsRepository } from "../superadmin/superadmin-settings.repository.js";
import { adminSettingsRepository } from "./admin-settings.repository.js";
import type {
  AdminAttendanceSettingsView,
  AdminAttendanceSettingsMutationResponse,
  AdminBiometricDeviceDeleteResponse,
  AdminBiometricDeviceListResponse,
  AdminBiometricDeviceMutationResponse,
  AdminBiometricDeviceSyncResponse,
  AdminCompanyProfileMutationResponse,
  AdminLocationCaptureSessionCancelResponse,
  AdminLocationCaptureSessionCaptureResponse,
  AdminLocationCaptureSessionCreateResponse,
  AdminLocationCaptureSessionStatusResponse,
  AdminNotificationSettingsView,
  AdminNotificationSettingsMutationResponse,
  AdminOfficeLocationListResponse,
  AdminOfficeLocationMutationResponse,
  AdminPayrollSettingsView,
  AdminPayrollSettingsMutationResponse,
  AdminSecuritySettingsView,
  AdminSiteLocationListResponse,
  AdminSiteLocationMutationResponse,
  AdminSettingsServiceResult,
  AdminSettingsWorkspaceResponse,
} from "./admin-settings.types.js";
import type {
  CreateAdminBiometricDeviceRequest,
  CaptureAdminLocationSessionRequest,
  CreateAdminOfficeLocationRequest,
  CreateAdminSiteLocationRequest,
  UpdateAdminAttendanceSettingsRequest,
  UpdateAdminBiometricDeviceRequest,
  UpdateAdminCompanyProfileRequest,
  UpdateAdminNotificationSettingsRequest,
  UpdateAdminOfficeLocationRequest,
  UpdateAdminSiteLocationRequest,
  UpdateAdminPayrollSettingsRequest,
} from "./admin-settings.validation.js";

function ok<T>(data: T): AdminSettingsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): AdminSettingsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

const ADMIN_LOCATION_CAPTURE_EXPIRY_MINUTES = 2;

function hashAdminLocationCaptureToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isAdminLocationCaptureTokenMatch(token: string, tokenHash: string) {
  const incomingHash = Buffer.from(hashAdminLocationCaptureToken(token), "hex");
  const storedHash = Buffer.from(tokenHash, "hex");

  if (incomingHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(incomingHash, storedHash);
}

function isInvalidAdminLocationCoordinate(latitude: number, longitude: number) {
  return (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (Math.abs(latitude) < 0.05 && Math.abs(longitude) < 0.05)
  );
}

function buildSecuritySummary(): Promise<AdminSecuritySettingsView> {
  return superadminSettingsRepository.getSettings().then((settings) => {
    const loginSecurityStatus =
      settings.security.enforceGlobalMfa ||
      settings.security.minimumPasswordLength >= 10 ||
      settings.security.requireUppercase ||
      settings.security.requireNumber ||
      settings.security.requireSpecialCharacter
        ? "protected"
        : "standard";

    return {
      controlledBy: "superadmin",
      enforceGlobalMfa: settings.security.enforceGlobalMfa,
      sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes,
      minimumPasswordLength: settings.security.minimumPasswordLength,
      requireUppercase: settings.security.requireUppercase,
      requireNumber: settings.security.requireNumber,
      requireSpecialCharacter: settings.security.requireSpecialCharacter,
      loginSecurityStatus,
      note: "Controlled by Superadmin",
    } satisfies AdminSecuritySettingsView;
  });
}

async function ensureCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

function recordSettingsAudit(
  user: AuthenticatedUser,
  action: string,
  metadata?: Record<string, unknown>,
) {
  if (!user.companyId) {
    return;
  }

  void auditService.recordAction(user, {
    companyId: user.companyId,
    action,
    entityType: "company_settings",
    entityId: user.companyId,
    metadata,
  });
}

async function validateSiteLocationReferences(
  companyId: string,
  input: CreateAdminSiteLocationRequest | UpdateAdminSiteLocationRequest,
) {
  if (input.projectId) {
    const projectExists = await adminSettingsRepository.projectBelongsToCompany(
      companyId,
      input.projectId,
    );

    if (!projectExists) {
      return "Selected project was not found for this company.";
    }
  }

  if (input.assignedEmployeeIds.length > 0) {
    const validEmployeeCount = await adminSettingsRepository.countActiveEmployeesByIds(
      companyId,
      input.assignedEmployeeIds,
    );

    if (validEmployeeCount !== input.assignedEmployeeIds.length) {
      return "One or more assigned employees were not found for this company.";
    }
  }

  return null;
}

function resolvePunchType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "check-out" || normalized === "out") {
    return "out" as const;
  }

  if (normalized === "check-in" || normalized === "in") {
    return "in" as const;
  }

  return "unknown" as const;
}

function resolveBiometricIdentifier(input: {
  biometricIdentifier: string | null;
  rawPayload: Record<string, unknown>;
}) {
  if (input.biometricIdentifier) {
    return input.biometricIdentifier;
  }

  const rawCandidates = [
    input.rawPayload.biometricIdentifier,
    input.rawPayload.employeeCode,
    input.rawPayload.employee_code,
    input.rawPayload.userId,
    input.rawPayload.user_id,
  ];

  for (const candidate of rawCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

export const adminSettingsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminSettingsWorkspaceResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const leavePoliciesResult = await policiesService.getWorkspace(user);

    if (!leavePoliciesResult.ok) {
      return fail(leavePoliciesResult.status, leavePoliciesResult.message);
    }

    const [
      companyProfile,
      officeLocations,
      siteLocations,
      attendanceSettings,
      biometricDevices,
      payrollSettings,
      notificationSettings,
      securitySettings,
      settingsSummary,
    ] = await Promise.all([
      adminSettingsRepository.findCompanyProfile(user.companyId),
      adminSettingsRepository.listOfficeLocations(user.companyId),
      adminSettingsRepository.listSiteLocations(user.companyId),
      adminSettingsRepository.getAttendanceSettings(user.companyId),
      adminSettingsRepository.listBiometricDevices(user.companyId),
      adminSettingsRepository.getPayrollSettings(user.companyId),
      adminSettingsRepository.getNotificationSettings(user.companyId),
      buildSecuritySummary(),
      adminSettingsRepository.getSettingsSummary(user.companyId),
    ]);

    if (
      !companyProfile ||
      !attendanceSettings ||
      !payrollSettings ||
      !notificationSettings
    ) {
      return fail(404, "Company settings could not be resolved.");
    }

    const leavePolicies = leavePoliciesResult.data.sections.filter(
      (section) => section.type === "leave",
    );
    const leavePolicyCount = leavePolicies.reduce(
      (count, section) => count + section.policies.length,
      0,
    );
    const payrollComponentCount =
      payrollSettings.salaryComponents.length +
      payrollSettings.earningsComponents.length +
      payrollSettings.deductionComponents.length;
    const activeNotificationChannels = [
      notificationSettings.emailNotifications,
      notificationSettings.smsNotifications,
      notificationSettings.inAppNotifications,
    ].filter(Boolean).length;

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      companyProfile,
      officeLocations,
      siteLocations,
      attendanceSettings,
      biometricDevices,
      leavePolicies,
      payrollSettings,
      notificationSettings,
      securitySettings,
      summary: {
        officeCount: settingsSummary.officeCount,
        biometricDeviceCount: settingsSummary.biometricDeviceCount,
        leavePolicyCount,
        payrollComponentCount,
        activeNotificationChannels,
        roleCount: settingsSummary.roleCount,
        documentCount: settingsSummary.documentCount,
      },
    });
  },

  async updateCompanyProfile(
    user: AuthenticatedUser,
    input: UpdateAdminCompanyProfileRequest,
  ): Promise<AdminSettingsServiceResult<AdminCompanyProfileMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const profile = await adminSettingsRepository.updateCompanyProfile(
      user.companyId,
      input,
    );

    if (!profile) {
      return fail(404, "Company profile could not be updated.");
    }

    recordSettingsAudit(user, "company_settings.profile_updated", {
      fields: Object.keys(input),
    });

    return ok({
      message: "Company profile updated successfully.",
      profile,
    });
  },

  async listOfficeLocations(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminOfficeLocationListResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      items: await adminSettingsRepository.listOfficeLocations(user.companyId),
    });
  },

  async createOfficeLocation(
    user: AuthenticatedUser,
    input: CreateAdminOfficeLocationRequest,
  ): Promise<AdminSettingsServiceResult<AdminOfficeLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const officeLocation = await adminSettingsRepository.createOfficeLocation(
      user.companyId,
      input,
    );

    if (!officeLocation) {
      return fail(404, "Office location could not be created.");
    }

    recordSettingsAudit(user, "company_settings.office_created", {
      officeLocationId: officeLocation.id,
      officeName: officeLocation.name,
    });

    return ok({
      message: "Office location saved successfully.",
      officeLocation,
    });
  },

  async updateOfficeLocation(
    user: AuthenticatedUser,
    officeLocationId: string,
    input: UpdateAdminOfficeLocationRequest,
  ): Promise<AdminSettingsServiceResult<AdminOfficeLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const officeLocation = await adminSettingsRepository.updateOfficeLocation(
      user.companyId,
      officeLocationId,
      input,
    );

    if (!officeLocation) {
      return fail(404, "Office location not found.");
    }

    recordSettingsAudit(user, "company_settings.office_updated", {
      officeLocationId,
    });

    return ok({
      message: "Office location updated successfully.",
      officeLocation,
    });
  },

  async deactivateOfficeLocation(
    user: AuthenticatedUser,
    officeLocationId: string,
  ): Promise<AdminSettingsServiceResult<AdminOfficeLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const officeLocation = await adminSettingsRepository.deactivateOfficeLocation(
      user.companyId,
      officeLocationId,
    );

    if (!officeLocation) {
      return fail(404, "Office location not found.");
    }

    recordSettingsAudit(user, "company_settings.office_deleted", {
      officeLocationId,
    });

    return ok({
      message: "Office location deleted successfully.",
      officeLocation,
    });
  },

  async listSiteLocations(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminSiteLocationListResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok(await adminSettingsRepository.listSiteLocations(user.companyId));
  },

  async createSiteLocation(
    user: AuthenticatedUser,
    input: CreateAdminSiteLocationRequest,
  ): Promise<AdminSettingsServiceResult<AdminSiteLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const referenceError = await validateSiteLocationReferences(user.companyId, input);

    if (referenceError) {
      return fail(409, referenceError);
    }

    const siteLocation = await adminSettingsRepository.createSiteLocation(
      user.companyId,
      user.id,
      input,
    );

    if (!siteLocation) {
      return fail(404, "Site location could not be created.");
    }

    recordSettingsAudit(user, "company_settings.site_location_created", {
      siteLocationId: siteLocation.id,
      siteLocationName: siteLocation.name,
      assignedEmployeeCount: siteLocation.assignedEmployees.length,
    });

    return ok({
      message: "Site location saved successfully.",
      siteLocation,
    });
  },

  async updateSiteLocation(
    user: AuthenticatedUser,
    siteLocationId: string,
    input: UpdateAdminSiteLocationRequest,
  ): Promise<AdminSettingsServiceResult<AdminSiteLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const referenceError = await validateSiteLocationReferences(user.companyId, input);

    if (referenceError) {
      return fail(409, referenceError);
    }

    const siteLocation = await adminSettingsRepository.updateSiteLocation(
      user.companyId,
      siteLocationId,
      user.id,
      input,
    );

    if (!siteLocation) {
      return fail(404, "Site location not found.");
    }

    recordSettingsAudit(user, "company_settings.site_location_updated", {
      siteLocationId,
      assignedEmployeeCount: siteLocation.assignedEmployees.length,
    });

    return ok({
      message: "Site location updated successfully.",
      siteLocation,
    });
  },

  async deactivateSiteLocation(
    user: AuthenticatedUser,
    siteLocationId: string,
  ): Promise<AdminSettingsServiceResult<AdminSiteLocationMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const siteLocation = await adminSettingsRepository.deactivateSiteLocation(
      user.companyId,
      siteLocationId,
    );

    if (!siteLocation) {
      return fail(404, "Site location not found.");
    }

    recordSettingsAudit(user, "company_settings.site_location_deactivated", {
      siteLocationId,
    });

    return ok({
      message: "Site location deactivated successfully.",
      siteLocation,
    });
  },

  async createOfficeLocationCaptureSession(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminLocationCaptureSessionCreateResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const companyId = user.companyId;

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + ADMIN_LOCATION_CAPTURE_EXPIRY_MINUTES * 60_000,
    ).toISOString();
    const createdSession =
      await adminSettingsRepository.createAdminLocationCaptureSession({
        companyId,
        adminUserId: user.id,
        tokenHash: hashAdminLocationCaptureToken(rawToken),
        expiresAt,
      });

    if (!createdSession) {
      return fail(404, "Phone GPS capture session could not be created.");
    }

    recordSettingsAudit(user, "company_settings.office_phone_capture_requested", {
      sessionId: createdSession.id,
    });

    return ok({
      sessionId: createdSession.id,
      status: createdSession.status,
      expiresAt: createdSession.expiresAt,
      rawToken,
    });
  },

  async getOfficeLocationCaptureSessionStatus(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<AdminSettingsServiceResult<AdminLocationCaptureSessionStatusResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const companyId = user.companyId;

    let session = await adminSettingsRepository.findAdminLocationCaptureSessionById(
      sessionId,
      {
        companyId,
        adminUserId: user.id,
      },
    );

    if (!session) {
      return fail(404, "Phone GPS capture session not found.");
    }

    if (session.status === "pending" && new Date(session.expiresAt).getTime() <= Date.now()) {
      session =
        (await adminSettingsRepository.updateAdminLocationCaptureSession({
          sessionId: session.id,
          companyId,
          adminUserId: user.id,
          status: "expired",
          failureReason: session.failureReason ?? "Phone GPS capture session expired.",
        })) ?? session;
    }

    return ok({
      sessionId: session.id,
      status: session.status,
      expiresAt: session.expiresAt,
      capturedAt: session.capturedAt,
      failureReason: session.failureReason,
      capturedLocation:
        session.capturedLatitude !== null && session.capturedLongitude !== null
          ? {
              latitude: session.capturedLatitude,
              longitude: session.capturedLongitude,
              accuracyMeters: session.capturedAccuracyMeters,
              address: session.capturedAddress,
              city: session.capturedCity,
              state: session.capturedState,
              country: session.capturedCountry,
            }
          : null,
    });
  },

  async cancelOfficeLocationCaptureSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<AdminSettingsServiceResult<AdminLocationCaptureSessionCancelResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const companyId = user.companyId;

    return withTransaction(async (executor) => {
      let session = await adminSettingsRepository.lockAdminLocationCaptureSessionById(
        sessionId,
        {
          companyId,
          adminUserId: user.id,
        },
        executor,
      );

      if (!session) {
        return fail<AdminLocationCaptureSessionCancelResponse>(
          404,
          "Phone GPS capture session not found.",
        );
      }

      if (session.status === "pending" && new Date(session.expiresAt).getTime() <= Date.now()) {
        session =
          (await adminSettingsRepository.updateAdminLocationCaptureSession(
            {
              sessionId: session.id,
              companyId,
              adminUserId: user.id,
              status: "expired",
              failureReason: session.failureReason ?? "Phone GPS capture session expired.",
            },
            executor,
          )) ?? session;
      }

      if (session.status !== "pending") {
        return fail<AdminLocationCaptureSessionCancelResponse>(
          409,
          session.status === "cancelled"
            ? "Phone GPS capture session is already cancelled."
            : session.failureReason ??
                `Phone GPS capture session cannot be cancelled because it is ${session.status}.`,
        );
      }

      const cancelledSession =
        (await adminSettingsRepository.updateAdminLocationCaptureSession(
          {
            sessionId: session.id,
            companyId,
            adminUserId: user.id,
            status: "cancelled",
            failureReason: "Phone GPS capture session cancelled by the admin.",
          },
          executor,
        )) ?? session;

      return ok({
        message: "Phone GPS capture session cancelled.",
        sessionId: cancelledSession.id,
        status: cancelledSession.status,
      });
    });
  },

  async captureOfficeLocationFromSession(
    user: AuthenticatedUser | null,
    sessionId: string,
    input: CaptureAdminLocationSessionRequest,
  ): Promise<AdminSettingsServiceResult<AdminLocationCaptureSessionCaptureResponse>> {
    if (isInvalidAdminLocationCoordinate(input.latitude, input.longitude)) {
      return fail(409, "The mobile device returned an invalid location near 0,0.");
    }

    return withTransaction(async (executor) => {
      let session = await adminSettingsRepository.lockAdminLocationCaptureSessionById(
        sessionId,
        {},
        executor,
      );

      if (!session) {
        return fail<AdminLocationCaptureSessionCaptureResponse>(
          404,
          "Phone GPS capture session not found.",
        );
      }

      if (!isAdminLocationCaptureTokenMatch(input.token, session.tokenHash)) {
        session =
          (await adminSettingsRepository.updateAdminLocationCaptureSession(
            {
              sessionId: session.id,
              companyId: session.companyId,
              adminUserId: session.adminUserId,
              status: "failed",
              failureReason: "Phone GPS capture token is invalid.",
            },
            executor,
          )) ?? session;

        return fail<AdminLocationCaptureSessionCaptureResponse>(
          409,
          session.failureReason ?? "Phone GPS capture token is invalid.",
        );
      }

      if (session.status !== "pending") {
        return fail<AdminLocationCaptureSessionCaptureResponse>(
          409,
          session.status === "captured"
            ? "This phone GPS capture session has already been used."
            : session.failureReason ??
                `This phone GPS capture session is ${session.status}.`,
        );
      }

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        session =
          (await adminSettingsRepository.updateAdminLocationCaptureSession(
            {
              sessionId: session.id,
              companyId: session.companyId,
              adminUserId: session.adminUserId,
              status: "expired",
              failureReason: "Phone GPS capture session expired.",
            },
            executor,
          )) ?? session;

        return fail<AdminLocationCaptureSessionCaptureResponse>(
          409,
          session.failureReason ?? "Phone GPS capture session expired.",
        );
      }

      const capturedSession =
        await adminSettingsRepository.updateAdminLocationCaptureSession(
          {
            sessionId: session.id,
            companyId: session.companyId,
            adminUserId: session.adminUserId,
            status: "captured",
            capturedAt: new Date().toISOString(),
            capturedLatitude: input.latitude,
            capturedLongitude: input.longitude,
            capturedAccuracyMeters: input.accuracy,
            capturedAddress: input.address,
            capturedCity: input.city,
            capturedState: input.state,
            capturedCountry: input.country,
            failureReason: null,
          },
          executor,
        );

      if (!capturedSession) {
        return fail<AdminLocationCaptureSessionCaptureResponse>(
          404,
          "Phone GPS capture session could not be updated.",
        );
      }

      if (user?.id === session.adminUserId && user.companyId === session.companyId) {
        recordSettingsAudit(user, "company_settings.office_phone_capture_completed", {
          sessionId: capturedSession.id,
        });
      }

      return ok({
        message: "Office GPS captured. Return to laptop and save office location.",
        status: capturedSession.status,
        capturedAt: capturedSession.capturedAt,
        capturedLocation: {
          latitude: capturedSession.capturedLatitude as number,
          longitude: capturedSession.capturedLongitude as number,
          accuracyMeters: capturedSession.capturedAccuracyMeters as number,
          address: capturedSession.capturedAddress,
          city: capturedSession.capturedCity,
          state: capturedSession.capturedState,
          country: capturedSession.capturedCountry,
        },
      });
    });
  },

  async getAttendanceSettings(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminAttendanceSettingsView>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.getAttendanceSettings(
      user.companyId,
    );

    if (!settings) {
      return fail(404, "Attendance settings could not be loaded.");
    }

    return ok(settings);
  },

  async updateAttendanceSettings(
    user: AuthenticatedUser,
    input: UpdateAdminAttendanceSettingsRequest,
  ): Promise<AdminSettingsServiceResult<AdminAttendanceSettingsMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.updateAttendanceSettings(
      user.companyId,
      input,
    );

    if (!settings) {
      return fail(404, "Attendance settings could not be updated.");
    }

    recordSettingsAudit(user, "company_settings.attendance_updated", {
      weeklyOffDays: input.weeklyOffDays,
    });

    return ok({
      message: "Attendance rules updated successfully.",
      settings,
    });
  },

  async listBiometricDevices(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminBiometricDeviceListResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      items: await adminSettingsRepository.listBiometricDevices(user.companyId),
    });
  },

  async createBiometricDevice(
    user: AuthenticatedUser,
    input: CreateAdminBiometricDeviceRequest,
  ): Promise<AdminSettingsServiceResult<AdminBiometricDeviceMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (input.officeLocationId) {
      const officeLocation = await adminSettingsRepository.findOfficeLocation(
        user.companyId,
        input.officeLocationId,
      );

      if (!officeLocation) {
        return fail(404, "Office location not found.");
      }
    }

    const device = await adminSettingsRepository.createBiometricDevice(
      user.companyId,
      input,
    );

    if (!device) {
      return fail(404, "Biometric device could not be created.");
    }

    recordSettingsAudit(user, "company_settings.biometric_device_created", {
      deviceId: device.id,
      deviceName: device.name,
    });

    return ok({
      message: "Biometric device saved successfully.",
      device,
    });
  },

  async updateBiometricDevice(
    user: AuthenticatedUser,
    deviceId: string,
    input: UpdateAdminBiometricDeviceRequest,
  ): Promise<AdminSettingsServiceResult<AdminBiometricDeviceMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    if (input.officeLocationId) {
      const officeLocation = await adminSettingsRepository.findOfficeLocation(
        user.companyId,
        input.officeLocationId,
      );

      if (!officeLocation) {
        return fail(404, "Office location not found.");
      }
    }

    const device = await adminSettingsRepository.updateBiometricDevice(
      user.companyId,
      deviceId,
      input,
    );

    if (!device) {
      return fail(404, "Biometric device not found.");
    }

    recordSettingsAudit(user, "company_settings.biometric_device_updated", {
      deviceId,
    });

    return ok({
      message: "Biometric device updated successfully.",
      device,
    });
  },

  async deactivateBiometricDevice(
    user: AuthenticatedUser,
    deviceId: string,
  ): Promise<AdminSettingsServiceResult<AdminBiometricDeviceDeleteResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const device = await adminSettingsRepository.deactivateBiometricDevice(
      user.companyId,
      deviceId,
    );

    if (!device) {
      return fail(404, "Biometric device not found.");
    }

    recordSettingsAudit(user, "company_settings.biometric_device_deleted", {
      deviceId,
    });

    return ok({
      message: "Biometric device removed successfully.",
      device,
    });
  },

  async syncBiometricDevice(
    user: AuthenticatedUser,
    deviceId: string,
  ): Promise<AdminSettingsServiceResult<AdminBiometricDeviceSyncResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const device = await adminSettingsRepository.findBiometricDevice(
      user.companyId,
      deviceId,
    );

    if (!device) {
      return fail(404, "Biometric device not found.");
    }

    const pendingLogs = await adminSettingsRepository.listPendingBiometricLogs(
      user.companyId,
      deviceId,
    );
    const attendanceSettings =
      await attendanceRepository.getCompanyAttendanceSettings(user.companyId);

    if (!attendanceSettings) {
      return fail(404, "Attendance settings could not be resolved.");
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const log of pendingLogs) {
      const biometricIdentifier = resolveBiometricIdentifier(log);
      const userId =
        log.userId ??
        (await adminSettingsRepository.resolveMappedUserId(
          user.companyId,
          deviceId,
          biometricIdentifier,
        ));

      if (!userId) {
        failedCount += 1;
        await adminSettingsRepository.updateBiometricLogSyncStatus(
          user.companyId,
          log.id,
          "failed",
        );
        continue;
      }

      const punchTime =
        log.punchTime instanceof Date
          ? log.punchTime.toISOString()
          : new Date(log.punchTime).toISOString();
      const attendanceDate = punchTime.slice(0, 10);
      const currentRecord = await attendanceRepository.findAttendanceRecordByDate(
        user.companyId,
        userId,
        attendanceDate,
      );
      const shiftAssignment = await shiftsRepository.findEmployeeShift(
        user.companyId,
        userId,
        attendanceDate,
      );
      const punchType = resolvePunchType(log.punchType);

      let nextCheckIn = currentRecord?.checkInAt ?? null;
      let nextCheckOut = currentRecord?.checkOutAt ?? null;

      if (punchType === "in") {
        if (!nextCheckIn || new Date(punchTime).getTime() < new Date(nextCheckIn).getTime()) {
          nextCheckIn = punchTime;
        }
      }

      if (punchType === "out") {
        if (!nextCheckOut || new Date(punchTime).getTime() > new Date(nextCheckOut).getTime()) {
          nextCheckOut = punchTime;
        }
      }

      const nextStatus =
        nextCheckIn && nextCheckOut
          ? attendanceService.calculateCompletedAttendanceStatus({
              attendanceDate,
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

      if (currentRecord) {
        await attendanceRepository.updateAttendanceRecord({
          companyId: user.companyId,
          userId,
          attendanceId: currentRecord.id,
          checkInAt: nextCheckIn,
          checkOutAt: nextCheckOut,
          status: nextStatus,
          source: "biometric",
          officeLocationId: device.officeLocationId,
          siteLocationId: null,
          projectId: null,
          biometricDeviceId: device.id,
          notes: currentRecord.notes ?? "Synced from biometric punch logs.",
        });
      } else {
        await attendanceRepository.insertAttendanceRecord({
          companyId: user.companyId,
          userId,
          attendanceDate,
          checkInAt: nextCheckIn,
          checkOutAt: nextCheckOut,
          status: nextStatus,
          source: "biometric",
          officeLocationId: device.officeLocationId,
          siteLocationId: null,
          projectId: null,
          biometricDeviceId: device.id,
          notes: "Synced from biometric punch logs.",
        });
      }

      processedCount += 1;
      await adminSettingsRepository.updateBiometricLogSyncStatus(
        user.companyId,
        log.id,
        "processed",
      );
    }

    const syncedDevice = await adminSettingsRepository.updateBiometricDeviceSyncState(
      user.companyId,
      deviceId,
      {
        status: device.isActive ? "online" : "inactive",
        lastSyncStatus:
          failedCount > 0 && processedCount === 0 ? "failed" : "success",
      },
    );

    if (!syncedDevice) {
      return fail(404, "Biometric device not found.");
    }

    recordSettingsAudit(user, "company_settings.biometric_device_sync_triggered", {
      deviceId,
      processedCount,
      failedCount,
    });

    return ok({
      message:
        pendingLogs.length === 0
          ? "Biometric sync completed. No pending punch logs were waiting for processing."
          : `Biometric sync completed. ${processedCount} log(s) processed and ${failedCount} log(s) failed.`,
      syncTriggered: true,
      device: syncedDevice,
    });
  },

  async getPayrollSettings(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminPayrollSettingsView>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.getPayrollSettings(
      user.companyId,
    );

    if (!settings) {
      return fail(404, "Payroll settings could not be loaded.");
    }

    return ok(settings);
  },

  async updatePayrollSettings(
    user: AuthenticatedUser,
    input: UpdateAdminPayrollSettingsRequest,
  ): Promise<AdminSettingsServiceResult<AdminPayrollSettingsMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.updatePayrollSettings(
      user.companyId,
      input,
    );

    if (!settings) {
      return fail(404, "Payroll settings could not be updated.");
    }

    recordSettingsAudit(user, "company_settings.payroll_updated", {
      salaryCycle: input.salaryCycle,
    });

    return ok({
      message: "Payroll settings updated successfully.",
      settings,
    });
  },

  async getNotificationSettings(
    user: AuthenticatedUser,
  ): Promise<AdminSettingsServiceResult<AdminNotificationSettingsView>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.getNotificationSettings(
      user.companyId,
    );

    if (!settings) {
      return fail(404, "Notification settings could not be loaded.");
    }

    return ok(settings);
  },

  async updateNotificationSettings(
    user: AuthenticatedUser,
    input: UpdateAdminNotificationSettingsRequest,
  ): Promise<AdminSettingsServiceResult<AdminNotificationSettingsMutationResponse>> {
    const company = await ensureCompanyContext(user);

    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const settings = await adminSettingsRepository.updateNotificationSettings(
      user.companyId,
      input,
    );

    if (!settings) {
      return fail(404, "Notification settings could not be updated.");
    }

    recordSettingsAudit(user, "company_settings.notifications_updated", input);

    return ok({
      message: "Notification preferences updated successfully.",
      settings,
    });
  },
};
