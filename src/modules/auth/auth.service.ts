import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { env } from "../../config/env.js";
import { withTransaction } from "../../database/index.js";
import { auditService } from "../audit/audit.service.js";
import { companiesRepository } from "../companies/companies.repository.js";
import type { PermissionKey } from "../permissions/permissions.types.js";
import { normalizePermissionKeys } from "../permissions/permissions.types.js";
import { getDashboardPathForRole } from "../roles/roles.types.js";
import { rolesRepository } from "../roles/roles.repository.js";
import { validatePasswordAgainstPolicy } from "./password-policy.js";
import { isMaintenanceActiveForRole } from "../superadmin/maintenance-mode.js";
import { superadminSettingsRepository } from "../superadmin/superadmin-settings.repository.js";
import { authRepository } from "./auth.repository.js";
import {
  buildAuthenticatorOtpAuthUrl,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  generateTwoFactorSecret,
  generatePasswordResetToken,
  hashRecoveryCode,
  hashPassword,
  hashPasswordResetToken,
  verifyTwoFactorCode,
  verifyPassword,
} from "./auth.password.js";
import {
  signAccessToken,
  signTwoFactorChallengeToken,
  signTwoFactorEnrollmentToken,
  signTwoFactorSetupToken,
  verifyAccessToken,
  verifyTwoFactorChallengeToken,
  verifyTwoFactorEnrollmentToken,
  verifyTwoFactorSetupToken,
} from "./auth.token.js";
import type {
  AuthenticatedSessionResponse,
  AuthSessionSummary,
  AuthenticatedUser,
  AuthRequestContext,
  ChangePasswordRequest,
  ChangePasswordResponse,
  AuthCompanyAccess,
  AuthNextStep,
  AuthRole,
  AuthUserIdentity,
  CurrentUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginSessionsResponse,
  LoginResponse,
  LogoutAllResponse,
  RevokeSessionRequest,
  RevokeSessionResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SelectCompanyRequest,
  SelectCompanyResponse,
  TwoFactorDisableRequest,
  TwoFactorLoginChallengeResponse,
  TwoFactorMutationResponse,
  TwoFactorSetupRequiredResponse,
  TwoFactorStatusResponse,
  TwoFactorVerifyLoginRequest,
  TwoFactorVerifySetupLoginRequest,
  TwoFactorVerifySetupRequest,
} from "./auth.types.js";

const TWO_FACTOR_CHALLENGE_EXPIRES_IN_SECONDS = 300;
const TWO_FACTOR_SETUP_EXPIRES_IN_SECONDS = 600;

type AuthServiceSuccess<T> = {
  ok: true;
  data: T;
};

type AuthServiceFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  message: string;
};

type AuthServiceResult<T> = AuthServiceSuccess<T> | AuthServiceFailure;

function ok<T>(data: T): AuthServiceSuccess<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 401 | 403 | 404 | 409 | 503,
  message: string,
): AuthServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function getNextStep(user: Pick<AuthenticatedUser, "role" | "companyId">): AuthNextStep {
  return user.role === "admin" && !user.companyId
    ? "select-company"
    : "dashboard";
}

function toSessionTimeoutSeconds(sessionTimeoutMinutes: number) {
  return Math.max(sessionTimeoutMinutes, 15) * 60;
}

async function ensurePasswordPolicy(password: string) {
  const { violations, message } = await validatePasswordAgainstPolicy(password);

  if (violations.length === 0) {
    return null;
  }

  return fail<never>(
    400,
    message ?? "Password does not satisfy the active platform security policy.",
  );
}

function mergePermissions(
  resolvedPermissions: readonly PermissionKey[],
  fallbackPermissions: readonly PermissionKey[],
) {
  if (resolvedPermissions.length > 0) {
    return normalizePermissionKeys(resolvedPermissions);
  }

  return normalizePermissionKeys(fallbackPermissions);
}

async function listAccessibleCompanies(
  user: Pick<AuthUserIdentity, "id" | "role" | "companyId">,
) {
  if (user.role === "admin") {
    return authRepository.listAdminAccessibleCompanies(user.id);
  }

  if (user.role === "superadmin" || !user.companyId) {
    return [] as AuthCompanyAccess[];
  }

  const company = await companiesRepository.findCompanyById(user.companyId);

  return company
    ? [{ id: company.id, name: company.name, code: company.code }]
    : [];
}

function resolveActiveCompanyId(
  user: Pick<AuthUserIdentity, "role" | "companyId">,
  accessibleCompanies: readonly AuthCompanyAccess[],
  preferredCompanyId?: string | null,
) {
  if (user.role === "superadmin") {
    return null;
  }

  if (user.role !== "admin") {
    return user.companyId;
  }

  if (
    preferredCompanyId &&
    accessibleCompanies.some((company) => company.id === preferredCompanyId)
  ) {
    return preferredCompanyId;
  }

  return accessibleCompanies.length === 1 ? accessibleCompanies[0].id : null;
}

async function serializeUser(
  identity: AuthUserIdentity,
  preferredCompanyId?: string | null,
  sessionId?: string | null,
) {
  const accessibleCompanies = await listAccessibleCompanies(identity);
  const activeCompanyId = resolveActiveCompanyId(
    identity,
    accessibleCompanies,
    preferredCompanyId,
  );
  const activeCompany =
    activeCompanyId && identity.role !== "superadmin"
      ? await companiesRepository.findCompanyById(activeCompanyId)
      : null;
  const resolvedPermissions = await rolesRepository.getPermissionsForRoleCode(
    activeCompanyId,
    identity.role,
  );

  return {
    id: identity.id,
    fullName: identity.fullName,
    email: identity.email,
    role: identity.role,
    sessionId: sessionId ?? null,
    companyId: activeCompanyId,
    activeCompany: activeCompany
      ? {
          id: activeCompany.id,
          name: activeCompany.name,
          code: activeCompany.code,
        }
      : null,
    accessibleCompanies,
    enabledModules: activeCompany?.enabledModules ?? [],
    permissions: mergePermissions(resolvedPermissions, identity.permissions),
    dashboardPath: getDashboardPathForRole(identity.role),
  } satisfies AuthenticatedUser;
}

function serializeTwoFactorStatus(record: Awaited<ReturnType<typeof authRepository.findTwoFactorByUserId>>): TwoFactorStatusResponse["twoFactor"] {
  const setupExpiresAt =
    record?.setupExpiresAt && new Date(record.setupExpiresAt).getTime() > Date.now()
      ? record.setupExpiresAt
      : null;

  return {
    isEnabled: record?.isEnabled ?? false,
    provider: "authenticator-app",
    enabledAt: record?.enabledAt ?? null,
    disabledAt: record?.disabledAt ?? null,
    lastVerifiedAt: record?.lastVerifiedAt ?? null,
    pendingSetup: Boolean(record?.pendingSecretEncrypted && setupExpiresAt),
    setupExpiresAt,
  };
}

function serializeLoginChallenge(
  identity: AuthUserIdentity,
  challengeToken: string,
): TwoFactorLoginChallengeResponse {
  return {
    message: "Two-factor verification required.",
    challengeToken,
    tokenType: "TwoFactor",
    expiresIn: TWO_FACTOR_CHALLENGE_EXPIRES_IN_SECONDS,
    nextStep: "two-factor",
    user: {
      id: identity.id,
      fullName: identity.fullName,
      email: identity.email,
      role: identity.role,
    },
  };
}

function serializeTwoFactorSetupRequired(
  identity: AuthUserIdentity,
  enrollmentToken: string,
  setupPayload: {
    setupToken: string;
    manualEntryKey: string;
    otpauthUrl: string;
    qrCodeImage: string;
    expiresAt: string;
    twoFactor: TwoFactorStatusResponse["twoFactor"];
  },
): TwoFactorSetupRequiredResponse {
  return {
    message:
      "Two-factor authentication setup is required before this login can continue.",
    enrollmentToken,
    setupToken: setupPayload.setupToken,
    manualEntryKey: setupPayload.manualEntryKey,
    otpauthUrl: setupPayload.otpauthUrl,
    qrCodeImage: setupPayload.qrCodeImage,
    tokenType: "TwoFactorSetup",
    expiresIn: TWO_FACTOR_SETUP_EXPIRES_IN_SECONDS,
    nextStep: "two-factor-setup",
    twoFactor: setupPayload.twoFactor,
    user: {
      id: identity.id,
      fullName: identity.fullName,
      email: identity.email,
      role: identity.role,
    },
  };
}

function mapSessionSummaries(
  sessions: Awaited<ReturnType<typeof authRepository.listSessions>>,
  currentSessionId: string | null | undefined,
): LoginSessionsResponse {
  const mappedSessions: AuthSessionSummary[] = sessions.map((session) => ({
    id: session.id,
    isCurrent: session.id === currentSessionId,
    status: session.status,
    deviceName: session.deviceName,
    browser: session.browser,
    operatingSystem: session.operatingSystem,
    deviceType: session.deviceType,
    ipAddress: session.ipAddress,
    approxLocation: session.approxLocation,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
  }));
  const activeSessions = mappedSessions.filter((session) => session.status === "active");
  const inactiveSessions = mappedSessions.filter(
    (session) => session.status !== "active",
  );

  return {
    sessions: activeSessions,
    inactiveSessions,
    totalActive: activeSessions.length,
    revokedTotal: inactiveSessions.filter((session) => session.status === "revoked")
      .length,
    expiredTotal: inactiveSessions.filter((session) => session.status === "expired")
      .length,
  };
}

async function buildTwoFactorSetupPayload(identity: AuthUserIdentity) {
  const manualEntryKey = generateTwoFactorSecret();
  const encryptedSecret = encryptTwoFactorSecret(manualEntryKey);
  const expiresAt = new Date(
    Date.now() + TWO_FACTOR_SETUP_EXPIRES_IN_SECONDS * 1000,
  );
  const setupToken = signTwoFactorSetupToken({
    userId: identity.id,
    passwordVersion: identity.passwordVersion,
    expiresInSeconds: TWO_FACTOR_SETUP_EXPIRES_IN_SECONDS,
  });
  const nextRecord = await authRepository.upsertPendingTwoFactorSetup(
    identity.id,
    encryptedSecret,
    expiresAt,
  );
  const otpauthUrl = buildAuthenticatorOtpAuthUrl(identity.email, manualEntryKey);
  const qrCodeImage = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return {
    setupToken: setupToken.token,
    manualEntryKey,
    otpauthUrl,
    qrCodeImage,
    expiresAt: expiresAt.toISOString(),
    twoFactor: serializeTwoFactorStatus(nextRecord),
  };
}

async function verifyTwoFactorEvidence(
  userId: string,
  record: NonNullable<Awaited<ReturnType<typeof authRepository.findTwoFactorByUserId>>>,
  input: {
    code?: string;
    recoveryCode?: string;
  },
) {
  if (!record.isEnabled || !record.secretEncrypted) {
    return false;
  }

  if (input.code) {
    const secret = decryptTwoFactorSecret(record.secretEncrypted);
    const isValid = verifyTwoFactorCode(secret, input.code);

    if (!isValid) {
      return false;
    }

    await authRepository.updateTwoFactorLastVerifiedAt(userId);
    return true;
  }

  if (input.recoveryCode) {
    const consumed = await authRepository.consumeRecoveryCode(
      userId,
      hashRecoveryCode(input.recoveryCode),
    );

    return Boolean(consumed);
  }

  return false;
}

async function createSessionResponse(
  identity: AuthUserIdentity,
  options?: {
    companyId?: string | null;
    message?: string;
    requestContext?: AuthRequestContext;
    sessionId?: string | null;
    sessionTimeoutMinutes?: number;
  },
): Promise<AuthServiceResult<AuthenticatedSessionResponse>> {
  const sessionTimeoutMinutes =
    options?.sessionTimeoutMinutes ??
    (await superadminSettingsRepository.getSettings()).security.sessionTimeoutMinutes;
  const expiresInSeconds = toSessionTimeoutSeconds(sessionTimeoutMinutes);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  let sessionId = options?.sessionId ?? randomUUID();

  if (options?.sessionId) {
    const refreshedSession = await authRepository.refreshSession(sessionId, expiresAt);

    if (!refreshedSession) {
      sessionId = randomUUID();
      await authRepository.createSession({
        id: sessionId,
        userId: identity.id,
        deviceName: options?.requestContext?.deviceName ?? null,
        browser: options?.requestContext?.browser ?? null,
        operatingSystem: options?.requestContext?.operatingSystem ?? null,
        deviceType: options?.requestContext?.deviceType ?? "unknown",
        ipAddress: options?.requestContext?.ipAddress ?? null,
        approxLocation: options?.requestContext?.approxLocation ?? null,
        userAgent: options?.requestContext?.userAgent ?? null,
        expiresAt,
      });
    }
  } else {
    await authRepository.createSession({
      id: sessionId,
      userId: identity.id,
      deviceName: options?.requestContext?.deviceName ?? null,
      browser: options?.requestContext?.browser ?? null,
      operatingSystem: options?.requestContext?.operatingSystem ?? null,
      deviceType: options?.requestContext?.deviceType ?? "unknown",
      ipAddress: options?.requestContext?.ipAddress ?? null,
      approxLocation: options?.requestContext?.approxLocation ?? null,
      userAgent: options?.requestContext?.userAgent ?? null,
      expiresAt,
    });
  }

  const user = await serializeUser(identity, options?.companyId, sessionId);

  if (identity.role === "admin" && user.accessibleCompanies.length === 0) {
    return fail(
      403,
      "No active company access is assigned to this admin account.",
    );
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
    enabledModules: user.enabledModules,
    sessionId,
    passwordVersion: identity.passwordVersion,
    permissions: user.permissions,
    expiresInSeconds,
  });

  return ok({
    message: options?.message ?? "Login successful.",
    accessToken: accessToken.token,
    tokenType: "Bearer",
    expiresIn: expiresInSeconds,
    nextStep: getNextStep(user),
    user,
  });
}

async function acquireUserResetLock(
  client: {
    query: (text: string, params?: unknown[]) => Promise<unknown>;
  },
  userId: string,
) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
    [userId],
  );
}

export const authService = {
  async login(
    input: LoginRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthServiceResult<LoginResponse>> {
    const user = await authRepository.findUserByEmail(input.email);

    if (!user || !user.isActive) {
      return fail(401, "Invalid email or password.");
    }

    const isValidPassword = verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      return fail(401, "Invalid email or password.");
    }

    const settings = await superadminSettingsRepository.getSettings();

    if (isMaintenanceActiveForRole(settings.operations, user.role)) {
      return fail(
        503,
        `${settings.general.platformName} is currently in maintenance mode for the ${user.role} dashboard. Only superadmin access is available right now.`,
      );
    }

    const twoFactor = await authRepository.findTwoFactorByUserId(user.id);

    if (twoFactor?.isEnabled && twoFactor.secretEncrypted) {
      const challenge = signTwoFactorChallengeToken({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordVersion: user.passwordVersion,
        expiresInSeconds: TWO_FACTOR_CHALLENGE_EXPIRES_IN_SECONDS,
      });

      return ok(serializeLoginChallenge(user, challenge.token));
    }

    if (settings.security.enforceGlobalMfa) {
      const enrollment = signTwoFactorEnrollmentToken({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordVersion: user.passwordVersion,
        expiresInSeconds: TWO_FACTOR_SETUP_EXPIRES_IN_SECONDS,
      });
      const setupPayload = await buildTwoFactorSetupPayload(user);

      return ok(
        serializeTwoFactorSetupRequired(
          user,
          enrollment.token,
          setupPayload,
        ),
      );
    }

    return createSessionResponse(user, {
      message: "Login successful.",
      requestContext,
      sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes,
    });
  },

  async verifyTwoFactorLogin(
    input: TwoFactorVerifyLoginRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthServiceResult<AuthenticatedSessionResponse>> {
    const challenge = verifyTwoFactorChallengeToken(input.challengeToken);

    if (!challenge) {
      return fail(401, "Two-factor challenge is invalid or expired.");
    }

    const identity = await authRepository.findUserById(challenge.sub);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    if (identity.passwordVersion !== challenge.passwordVersion) {
      return fail(401, "Two-factor challenge is no longer valid.");
    }

    const record = await authRepository.findTwoFactorByUserId(identity.id);

    if (!record?.isEnabled || !record.secretEncrypted) {
      return fail(409, "Two-factor authentication is not enabled for this account.");
    }

    const settings = await superadminSettingsRepository.getSettings();

    if (isMaintenanceActiveForRole(settings.operations, identity.role)) {
      return fail(
        503,
        `${settings.general.platformName} is currently in maintenance mode for the ${identity.role} dashboard. Only superadmin access is available right now.`,
      );
    }

    const isValid = await verifyTwoFactorEvidence(identity.id, record, input);

    if (!isValid) {
      return fail(401, "The verification code or recovery code is invalid.");
    }

    return createSessionResponse(identity, {
      message: "Two-factor verification complete. Login successful.",
      requestContext,
    });
  },

  async verifyTwoFactorSetupLogin(
    input: TwoFactorVerifySetupLoginRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthServiceResult<AuthenticatedSessionResponse>> {
    const enrollmentToken = verifyTwoFactorEnrollmentToken(input.enrollmentToken);

    if (!enrollmentToken) {
      return fail(401, "Two-factor enrollment is invalid or expired.");
    }

    const identity = await authRepository.findUserById(enrollmentToken.sub);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    if (identity.passwordVersion !== enrollmentToken.passwordVersion) {
      return fail(401, "Two-factor enrollment is no longer valid.");
    }

    const setupToken = verifyTwoFactorSetupToken(input.setupToken);

    if (
      !setupToken ||
      setupToken.sub !== identity.id ||
      setupToken.passwordVersion !== identity.passwordVersion
    ) {
      return fail(401, "Two-factor setup token is invalid or expired.");
    }

    const existingRecord = await authRepository.findTwoFactorByUserId(identity.id);

    if (
      !existingRecord?.pendingSecretEncrypted ||
      !existingRecord.setupExpiresAt ||
      new Date(existingRecord.setupExpiresAt).getTime() <= Date.now()
    ) {
      return fail(409, "Two-factor setup is not active. Restart login to continue.");
    }

    const settings = await superadminSettingsRepository.getSettings();

    if (isMaintenanceActiveForRole(settings.operations, identity.role)) {
      return fail(
        503,
        `${settings.general.platformName} is currently in maintenance mode for the ${identity.role} dashboard. Only superadmin access is available right now.`,
      );
    }

    const secret = decryptTwoFactorSecret(existingRecord.pendingSecretEncrypted);

    if (!verifyTwoFactorCode(secret, input.code)) {
      return fail(400, "The verification code is invalid.");
    }

    const recoveryCodes = generateRecoveryCodes();
    await authRepository.enableTwoFactor(
      identity.id,
      encryptTwoFactorSecret(secret),
      recoveryCodes.map(hashRecoveryCode),
    );
    const sessionResponse = await createSessionResponse(identity, {
      message: "Two-factor setup complete. Login successful.",
      requestContext,
    });

    if (!sessionResponse.ok) {
      return sessionResponse;
    }

    void auditService.recordAction(sessionResponse.data.user, {
      companyId: sessionResponse.data.user.companyId,
      action: "employee.two_factor.enabled",
      entityType: "user",
      entityId: identity.id,
      metadata: {
        userId: identity.id,
        role: identity.role,
        source: "login-enrollment",
        recoveryCodesIssued: recoveryCodes.length,
      },
    });

    return ok({
      ...sessionResponse.data,
      message: "Two-factor setup complete. Login successful.",
      recoveryCodes,
    });
  },

  getCurrentUser(authenticatedUser: AuthenticatedUser): CurrentUserResponse {
    return {
      authenticated: true,
      nextStep: getNextStep(authenticatedUser),
      user: authenticatedUser,
    };
  },

  async getTwoFactorStatus(
    authenticatedUser: AuthenticatedUser | undefined,
  ): Promise<AuthServiceResult<TwoFactorStatusResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    const twoFactor = await authRepository.findTwoFactorByUserId(identity.id);

    return ok({
      twoFactor: serializeTwoFactorStatus(twoFactor),
    });
  },

  async beginTwoFactorSetup(
    authenticatedUser: AuthenticatedUser | undefined,
  ): Promise<AuthServiceResult<TwoFactorStatusResponse & {
    message: string;
    setupToken: string;
    manualEntryKey: string;
    otpauthUrl: string;
    qrCodeImage: string;
    expiresAt: string;
  }>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    const existingRecord = await authRepository.findTwoFactorByUserId(identity.id);

    if (existingRecord?.isEnabled && existingRecord.secretEncrypted) {
      return fail(409, "Two-factor authentication is already enabled.");
    }

    const setupPayload = await buildTwoFactorSetupPayload(identity);

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "employee.two_factor.setup.started",
      entityType: "user",
      entityId: identity.id,
      metadata: {
        userId: identity.id,
        role: identity.role,
      },
    });

    return ok({
      message: "Two-factor setup started. Add the key to your authenticator app and verify the generated code.",
      ...setupPayload,
    });
  },

  async verifyTwoFactorSetup(
    authenticatedUser: AuthenticatedUser | undefined,
    input: TwoFactorVerifySetupRequest,
  ): Promise<AuthServiceResult<TwoFactorMutationResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    const setupToken = verifyTwoFactorSetupToken(input.setupToken);

    if (
      !setupToken ||
      setupToken.sub !== identity.id ||
      setupToken.passwordVersion !== identity.passwordVersion
    ) {
      return fail(401, "Two-factor setup token is invalid or expired.");
    }

    const existingRecord = await authRepository.findTwoFactorByUserId(identity.id);

    if (
      !existingRecord?.pendingSecretEncrypted ||
      !existingRecord.setupExpiresAt ||
      new Date(existingRecord.setupExpiresAt).getTime() <= Date.now()
    ) {
      return fail(409, "Two-factor setup is not active. Start setup again.");
    }

    const secret = decryptTwoFactorSecret(existingRecord.pendingSecretEncrypted);

    if (!verifyTwoFactorCode(secret, input.code)) {
      return fail(400, "The verification code is invalid.");
    }

    const recoveryCodes = generateRecoveryCodes();
    const updatedRecord = await authRepository.enableTwoFactor(
      identity.id,
      encryptTwoFactorSecret(secret),
      recoveryCodes.map(hashRecoveryCode),
    );

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "employee.two_factor.enabled",
      entityType: "user",
      entityId: identity.id,
      metadata: {
        userId: identity.id,
        role: identity.role,
      },
    });

    return ok({
      message: "Two-factor authentication enabled successfully.",
      status: "success",
      twoFactor: serializeTwoFactorStatus(updatedRecord),
      recoveryCodes,
    });
  },

  async disableTwoFactor(
    authenticatedUser: AuthenticatedUser | undefined,
    input: TwoFactorDisableRequest,
  ): Promise<AuthServiceResult<TwoFactorMutationResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    if (!verifyPassword(input.currentPassword, identity.passwordHash)) {
      return fail(400, "Current password is incorrect.");
    }

    const record = await authRepository.findTwoFactorByUserId(identity.id);

    if (!record?.isEnabled || !record.secretEncrypted) {
      return fail(409, "Two-factor authentication is not enabled.");
    }

    const isValid = await verifyTwoFactorEvidence(identity.id, record, input);

    if (!isValid) {
      return fail(401, "The verification code or recovery code is invalid.");
    }

    const updatedRecord = await authRepository.disableTwoFactor(identity.id);

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "employee.two_factor.disabled",
      entityType: "user",
      entityId: identity.id,
      metadata: {
        userId: identity.id,
        role: identity.role,
      },
    });

    return ok({
      message: "Two-factor authentication disabled successfully.",
      status: "success",
      twoFactor: serializeTwoFactorStatus(updatedRecord),
    });
  },

  async regenerateTwoFactorRecoveryCodes(
    authenticatedUser: AuthenticatedUser | undefined,
    input: TwoFactorDisableRequest,
  ): Promise<AuthServiceResult<TwoFactorMutationResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    if (!verifyPassword(input.currentPassword, identity.passwordHash)) {
      return fail(400, "Current password is incorrect.");
    }

    const record = await authRepository.findTwoFactorByUserId(identity.id);

    if (!record?.isEnabled || !record.secretEncrypted) {
      return fail(409, "Two-factor authentication is not enabled.");
    }

    const isValid = await verifyTwoFactorEvidence(identity.id, record, input);

    if (!isValid) {
      return fail(401, "The verification code or recovery code is invalid.");
    }

    const recoveryCodes = generateRecoveryCodes();
    const updatedRecord = await authRepository.replaceTwoFactorRecoveryCodes(
      identity.id,
      recoveryCodes.map(hashRecoveryCode),
    );

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "employee.two_factor.recovery_codes.regenerated",
      entityType: "user",
      entityId: identity.id,
      metadata: {
        userId: identity.id,
        role: identity.role,
      },
    });

    return ok({
      message: "Recovery codes regenerated successfully.",
      status: "success",
      twoFactor: serializeTwoFactorStatus(updatedRecord),
      recoveryCodes,
    });
  },

  async getLoginSessions(
    authenticatedUser: AuthenticatedUser | undefined,
  ): Promise<AuthServiceResult<LoginSessionsResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    const sessions = await authRepository.listSessions(identity.id);

    return ok(mapSessionSummaries(sessions, authenticatedUser.sessionId));
  },

  async revokeSession(
    authenticatedUser: AuthenticatedUser | undefined,
    input: RevokeSessionRequest,
  ): Promise<AuthServiceResult<RevokeSessionResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    const revoked = await authRepository.revokeSession(identity.id, input.sessionId);

    if (!revoked) {
      return fail(404, "Session not found or already revoked.");
    }

    const sessions = await authRepository.listSessions(identity.id);

    return ok({
      message:
        input.sessionId === authenticatedUser.sessionId
          ? "Current session revoked. Please sign in again."
          : "Session revoked successfully.",
      status: "success",
      ...mapSessionSummaries(sessions, authenticatedUser.sessionId),
    });
  },

  async revokeOtherSessions(
    authenticatedUser: AuthenticatedUser | undefined,
  ): Promise<AuthServiceResult<RevokeSessionResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    await authRepository.revokeOtherSessions(
      identity.id,
      authenticatedUser.sessionId ?? null,
    );
    const sessions = await authRepository.listSessions(identity.id);

    return ok({
      message: "All other active sessions have been revoked.",
      status: "success",
      ...mapSessionSummaries(sessions, authenticatedUser.sessionId),
    });
  },

  async selectCompany(
    authenticatedUser: AuthenticatedUser | undefined,
    input: SelectCompanyRequest,
  ): Promise<AuthServiceResult<SelectCompanyResponse>> {
    if (!authenticatedUser || authenticatedUser.role !== "admin") {
      return fail(403, "Only admin accounts can select an active company.");
    }

    if (
      !authenticatedUser.accessibleCompanies.some(
        (company) => company.id === input.companyId,
      )
    ) {
      return fail(404, "The selected company is not available for this admin.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Admin account not found.");
    }

    return createSessionResponse(identity, {
      companyId: input.companyId,
      sessionId: authenticatedUser.sessionId ?? null,
      message: authenticatedUser.companyId
        ? "Active company switched successfully."
        : "Company selected successfully.",
    });
  },

  async changePassword(
    authenticatedUser: AuthenticatedUser | undefined,
    input: ChangePasswordRequest,
  ): Promise<AuthServiceResult<ChangePasswordResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    if (!verifyPassword(input.currentPassword, identity.passwordHash)) {
      return fail(400, "Current password is incorrect.");
    }

    if (verifyPassword(input.newPassword, identity.passwordHash)) {
      return fail(
        400,
        "New password must be different from the current password.",
      );
    }

    const passwordPolicyFailure = await ensurePasswordPolicy(input.newPassword);

    if (passwordPolicyFailure) {
      return passwordPolicyFailure;
    }

    const passwordUpdated = await authRepository.updateUserPassword(
      identity.id,
      hashPassword(input.newPassword),
    );

    if (!passwordUpdated) {
      return fail(404, "Authenticated user not found.");
    }

    await authRepository.revokeAllSessionRows(identity.id);

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "password_changed",
      entityType: "user",
      entityId: authenticatedUser.id,
      metadata: {
        userId: authenticatedUser.id,
        role: authenticatedUser.role,
        mode: "self-service",
      },
    });

    return ok({
      message:
        "Password updated successfully. Use the new password the next time you sign in.",
      status: "success",
    });
  },

  async logoutAllSessions(
    authenticatedUser: AuthenticatedUser | undefined,
  ): Promise<AuthServiceResult<LogoutAllResponse>> {
    if (!authenticatedUser) {
      return fail(403, "Authentication required.");
    }

    const identity = await authRepository.findUserById(authenticatedUser.id);

    if (!identity || !identity.isActive) {
      return fail(404, "Authenticated user not found.");
    }

    await authRepository.revokeAllSessionRows(identity.id);
    const sessionsInvalidated = await authRepository.invalidateUserSessions(identity.id);

    if (!sessionsInvalidated) {
      return fail(404, "Authenticated user not found.");
    }

    void auditService.recordAction(authenticatedUser, {
      companyId: authenticatedUser.companyId,
      action: "employee.sessions.invalidated",
      entityType: "user",
      entityId: authenticatedUser.id,
      metadata: {
        userId: authenticatedUser.id,
        role: authenticatedUser.role,
        mode: "self-service",
      },
    });

    return ok({
      message: "All active sessions have been invalidated. Please sign in again.",
      status: "success",
    });
  },

  async verifySession(token: string) {
    const payload = verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    const user = await authRepository.findUserById(payload.sub);

    if (!user || !user.isActive) {
      return null;
    }

    if ((payload.passwordVersion ?? 0) !== user.passwordVersion) {
      return null;
    }

    if (payload.sessionId) {
      const session = await authRepository.findSessionById(payload.sessionId);

      if (
        !session ||
        session.userId !== user.id ||
        session.isRevoked ||
        new Date(session.expiresAt).getTime() <= Date.now()
      ) {
        return null;
      }

      const sessionTimeoutMinutes =
        (await superadminSettingsRepository.getSettings()).security
          .sessionTimeoutMinutes;
      const refreshedSession = await authRepository.refreshSession(
        payload.sessionId,
        new Date(Date.now() + toSessionTimeoutSeconds(sessionTimeoutMinutes) * 1000),
      );

      if (!refreshedSession) {
        return null;
      }
    }

    return serializeUser(user, payload.companyId, payload.sessionId ?? null);
  },

  async startForgotPassword(
    input: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    const user = await authRepository.findUserByEmail(input.email);

    if (!user || !user.isActive) {
      return {
        message:
          "If the account exists, password reset instructions will be sent.",
        status: "accepted",
      };
    }

    const resetToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(resetToken);
    const expiresAt = new Date(
      Date.now() + env.authPasswordResetTokenExpiresInSeconds * 1000,
    );

    await withTransaction(async (client) => {
      await acquireUserResetLock(client, user.id);

      await client.query(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = $1
        `,
        [user.id],
      );

      await client.query(
        `
          INSERT INTO password_reset_tokens (
            id,
            user_id,
            token_hash,
            expires_at,
            used,
            created_at
          ) VALUES ($1, $2, $3, $4, FALSE, NOW())
        `,
        [randomUUID(), user.id, tokenHash, expiresAt],
      );
    });

    return {
      message:
        "If the account exists, password reset instructions will be sent.",
      status: "accepted",
      ...(env.nodeEnv !== "production"
        ? {
            resetToken,
          }
        : {}),
    };
  },

  async resetPassword(
    input: ResetPasswordRequest,
  ): Promise<AuthServiceResult<ResetPasswordResponse>> {
    const tokenHash = hashPasswordResetToken(input.token);
    const existingToken = await authRepository.findPasswordResetTokenByHash(
      tokenHash,
    );

    if (!existingToken) {
      return fail(400, "Reset token is invalid or expired.");
    }

    return withTransaction(async (client) => {
      await acquireUserResetLock(client, existingToken.userId);

      const tokenResult = await client.query<{
        id: string;
        userId: string;
        used: boolean;
        expiresAt: string;
        userIsActive: boolean;
        userCompanyId: string | null;
      }>(
        `
          SELECT
            tokens.id,
            tokens.user_id AS "userId",
            tokens.used,
            tokens.expires_at AS "expiresAt",
            users.is_active AS "userIsActive",
            users.company_id AS "userCompanyId"
          FROM password_reset_tokens AS tokens
          INNER JOIN users
            ON users.id = tokens.user_id
          WHERE tokens.token_hash = $1
          LIMIT 1
          FOR UPDATE OF tokens
        `,
        [tokenHash],
      );

      const token = tokenResult.rows[0];

      if (
        !token ||
        token.used ||
        !token.userIsActive ||
        new Date(token.expiresAt).getTime() <= Date.now()
      ) {
        return fail(400, "Reset token is invalid or expired.");
      }

      const passwordPolicyFailure = await ensurePasswordPolicy(input.newPassword);

      if (passwordPolicyFailure) {
        return passwordPolicyFailure;
      }

      const passwordHash = hashPassword(input.newPassword);

      await client.query(
        `
          UPDATE users
          SET
            password_hash = $2,
            password_version = password_version + 1,
            updated_at = NOW()
          WHERE id = $1
        `,
        [token.userId, passwordHash],
      );

      await client.query(
        `
          UPDATE user_sessions
          SET
            is_revoked = TRUE,
            revoked_at = NOW(),
            updated_at = NOW()
          WHERE user_id = $1
            AND is_revoked = FALSE
        `,
        [token.userId],
      );

      await client.query(
        `
          UPDATE password_reset_tokens
          SET used = TRUE
          WHERE user_id = $1
            AND used = FALSE
        `,
        [token.userId],
      );

      return ok({
        message: "Password reset successfully. Please sign in again.",
        status: "success" as const,
      });
    });
  },
};
