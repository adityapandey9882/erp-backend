import type { Request } from "express";
import type { CompanyModuleKey } from "../companies/companies.types.js";
import type { PermissionKey } from "../permissions/permissions.types.js";
import type { AppRole } from "../roles/roles.types.js";

export type AuthRole = AppRole;
export type AuthSessionDeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type AuthUserIdentity = {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
  companyId: string | null;
  permissions: PermissionKey[];
  passwordHash: string;
  passwordVersion: number;
  isActive: boolean;
};

export type AuthCompanyAccess = {
  id: string;
  name: string;
  code: string;
};

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
  sessionId?: string | null;
  companyId: string | null;
  activeCompany: AuthCompanyAccess | null;
  accessibleCompanies: AuthCompanyAccess[];
  enabledModules: CompanyModuleKey[];
  permissions: PermissionKey[];
  dashboardPath: string;
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  fullName: string;
  role: AuthRole;
  companyId?: string | null;
  enabledModules?: CompanyModuleKey[];
  sessionId?: string | null;
  passwordVersion: number;
  permissions: PermissionKey[];
  iat: number;
  exp: number;
};

export type AuthLoginChallengeTokenPayload = {
  kind: "two-factor";
  sub: string;
  email: string;
  fullName: string;
  role: AuthRole;
  passwordVersion: number;
  iat: number;
  exp: number;
};

export type AuthEnrollmentTokenPayload = {
  kind: "two-factor-enrollment";
  sub: string;
  email: string;
  fullName: string;
  role: AuthRole;
  passwordVersion: number;
  iat: number;
  exp: number;
};

export type AuthSetupTokenPayload = {
  kind: "two-factor-setup";
  sub: string;
  passwordVersion: number;
  iat: number;
  exp: number;
};

export type AuthRequestContext = {
  userAgent: string | null;
  ipAddress: string | null;
  approxLocation: string | null;
  deviceName: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: AuthSessionDeviceType;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type SelectCompanyRequest = {
  companyId: string;
};

export type AuthNextStep = "dashboard" | "select-company";
export type AuthLoginNextStep = AuthNextStep | "two-factor" | "two-factor-setup";

export type AuthenticatedSessionResponse = {
  message: string;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  nextStep: AuthNextStep;
  user: AuthenticatedUser;
  recoveryCodes?: string[];
};

export type AuthChallengeUser = {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
};

export type TwoFactorLoginChallengeResponse = {
  message: string;
  challengeToken: string;
  tokenType: "TwoFactor";
  expiresIn: number;
  nextStep: "two-factor";
  user: AuthChallengeUser;
};

export type TwoFactorSetupRequiredResponse = {
  message: string;
  enrollmentToken: string;
  setupToken: string;
  manualEntryKey: string;
  otpauthUrl: string;
  qrCodeImage: string;
  tokenType: "TwoFactorSetup";
  expiresIn: number;
  nextStep: "two-factor-setup";
  twoFactor: TwoFactorStatusResponse["twoFactor"];
  user: AuthChallengeUser;
};

export type LoginResponse =
  | AuthenticatedSessionResponse
  | TwoFactorLoginChallengeResponse
  | TwoFactorSetupRequiredResponse;

export type SelectCompanyResponse = AuthenticatedSessionResponse;

export type CurrentUserResponse = {
  authenticated: true;
  nextStep: AuthNextStep;
  user: AuthenticatedUser;
};

export type ForgotPasswordResponse = {
  message: string;
  status: "accepted";
  resetToken?: string;
};

export type ResetPasswordResponse = {
  message: string;
  status: "success";
};

export type ChangePasswordResponse = {
  message: string;
  status: "success";
};

export type LogoutAllResponse = {
  message: string;
  status: "success";
};

export type TwoFactorStatusResponse = {
  twoFactor: {
    isEnabled: boolean;
    provider: "authenticator-app";
    enabledAt: string | null;
    disabledAt: string | null;
    lastVerifiedAt: string | null;
    pendingSetup: boolean;
    setupExpiresAt: string | null;
  };
};

export type TwoFactorSetupResponse = {
  message: string;
  setupToken: string;
  manualEntryKey: string;
  otpauthUrl: string;
  qrCodeImage: string;
  expiresAt: string;
  twoFactor: TwoFactorStatusResponse["twoFactor"];
};

export type TwoFactorVerifySetupRequest = {
  setupToken: string;
  code: string;
};

export type TwoFactorVerifySetupLoginRequest = {
  enrollmentToken: string;
  setupToken: string;
  code: string;
};

export type TwoFactorDisableRequest = {
  currentPassword: string;
  code?: string;
  recoveryCode?: string;
};

export type TwoFactorRegenerateRecoveryCodesRequest = TwoFactorDisableRequest;

export type TwoFactorVerifyLoginRequest = {
  challengeToken: string;
  code?: string;
  recoveryCode?: string;
};

export type TwoFactorMutationResponse = {
  message: string;
  status: "success";
  twoFactor: TwoFactorStatusResponse["twoFactor"];
  recoveryCodes?: string[];
};

export type AuthSessionSummary = {
  id: string;
  isCurrent: boolean;
  status: "active" | "revoked" | "expired";
  deviceName: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  ipAddress: string | null;
  approxLocation: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export type LoginSessionsResponse = {
  sessions: AuthSessionSummary[];
  inactiveSessions: AuthSessionSummary[];
  totalActive: number;
  revokedTotal: number;
  expiredTotal: number;
};

export type RevokeSessionRequest = {
  sessionId: string;
};

export type RevokeSessionResponse = {
  message: string;
  status: "success";
  sessions: AuthSessionSummary[];
  inactiveSessions: AuthSessionSummary[];
  totalActive: number;
  revokedTotal: number;
  expiredTotal: number;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedUser;
};

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationFailure = {
  success: false;
  errors: string[];
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;
