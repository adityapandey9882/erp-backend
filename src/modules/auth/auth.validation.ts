import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RevokeSessionRequest,
  ResetPasswordRequest,
  SelectCompanyRequest,
  TwoFactorDisableRequest,
  TwoFactorVerifyLoginRequest,
  TwoFactorVerifySetupLoginRequest,
  TwoFactorVerifySetupRequest,
  ValidationResult,
} from "./auth.types.js";

function fail<T>(...errors: string[]): ValidationResult<T> {
  return {
    success: false,
    errors,
  };
}

function success<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateLoginPayload(input: unknown): ValidationResult<LoginRequest> {
  if (!input || typeof input !== "object") {
    return fail("Login payload is required.");
  }

  const email = normalizeString((input as Record<string, unknown>).email).toLowerCase();
  const password = normalizeString((input as Record<string, unknown>).password);

  if (!email || !isEmail(email)) {
    return fail("A valid email address is required.");
  }

  if (!password || password.length < 8) {
    return fail("Password must be at least 8 characters long.");
  }

  return success({ email, password });
}

export function validateForgotPasswordPayload(
  input: unknown,
): ValidationResult<ForgotPasswordRequest> {
  if (!input || typeof input !== "object") {
    return fail("Forgot password payload is required.");
  }

  const email = normalizeString((input as Record<string, unknown>).email).toLowerCase();

  if (!email || !isEmail(email)) {
    return fail("A valid email address is required.");
  }

  return success({ email });
}

export function validateResetPasswordPayload(
  input: unknown,
): ValidationResult<ResetPasswordRequest> {
  if (!input || typeof input !== "object") {
    return fail("Reset password payload is required.");
  }

  const token = normalizeString((input as Record<string, unknown>).token);
  const newPassword = normalizeString(
    (input as Record<string, unknown>).newPassword,
  );
  const confirmPassword = normalizeString(
    (input as Record<string, unknown>).confirmPassword,
  );

  if (
    !token ||
    token.length < 32 ||
    token.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return fail("Reset token is required.");
  }

  if (!newPassword || newPassword.length < 8) {
    return fail("New password must be at least 8 characters long.");
  }

  if (newPassword !== confirmPassword) {
    return fail("Password confirmation does not match.");
  }

  return success({ token, newPassword, confirmPassword });
}

export function validateChangePasswordPayload(
  input: unknown,
): ValidationResult<ChangePasswordRequest> {
  if (!input || typeof input !== "object") {
    return fail("Change password payload is required.");
  }

  const currentPassword = normalizeString(
    (input as Record<string, unknown>).currentPassword,
  );
  const newPassword = normalizeString(
    (input as Record<string, unknown>).newPassword,
  );
  const confirmPassword = normalizeString(
    (input as Record<string, unknown>).confirmPassword,
  );

  if (!currentPassword || currentPassword.length < 8) {
    return fail("Current password must be at least 8 characters long.");
  }

  if (!newPassword || newPassword.length < 8) {
    return fail("New password must be at least 8 characters long.");
  }

  if (newPassword !== confirmPassword) {
    return fail("Password confirmation does not match.");
  }

  return success({
    currentPassword,
    newPassword,
    confirmPassword,
  });
}

export function validateSelectCompanyPayload(
  input: unknown,
): ValidationResult<SelectCompanyRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company selection payload is required.");
  }

  const companyId = normalizeString((input as Record<string, unknown>).companyId);

  if (!companyId) {
    return fail("A company selection is required.");
  }

  return success({ companyId });
}

export function validateTwoFactorVerifySetupPayload(
  input: unknown,
): ValidationResult<TwoFactorVerifySetupRequest> {
  if (!input || typeof input !== "object") {
    return fail("Two-factor setup verification payload is required.");
  }

  const setupToken = normalizeString((input as Record<string, unknown>).setupToken);
  const code = normalizeString((input as Record<string, unknown>).code);

  if (!setupToken) {
    return fail("A setup token is required.");
  }

  if (!/^\d{6}$/.test(code)) {
    return fail("A valid 6-digit verification code is required.");
  }

  return success({ setupToken, code });
}

export function validateTwoFactorVerifySetupLoginPayload(
  input: unknown,
): ValidationResult<TwoFactorVerifySetupLoginRequest> {
  if (!input || typeof input !== "object") {
    return fail("Two-factor login setup verification payload is required.");
  }

  const enrollmentToken = normalizeString(
    (input as Record<string, unknown>).enrollmentToken,
  );
  const setupToken = normalizeString((input as Record<string, unknown>).setupToken);
  const code = normalizeString((input as Record<string, unknown>).code);

  if (!enrollmentToken) {
    return fail("Enrollment token is required.");
  }

  if (!setupToken) {
    return fail("A setup token is required.");
  }

  if (!/^\d{6}$/.test(code)) {
    return fail("A valid 6-digit verification code is required.");
  }

  return success({ enrollmentToken, setupToken, code });
}

export function validateTwoFactorDisablePayload(
  input: unknown,
): ValidationResult<TwoFactorDisableRequest> {
  if (!input || typeof input !== "object") {
    return fail("Two-factor mutation payload is required.");
  }

  const currentPassword = normalizeString(
    (input as Record<string, unknown>).currentPassword,
  );
  const code = normalizeString((input as Record<string, unknown>).code);
  const recoveryCode = normalizeString(
    (input as Record<string, unknown>).recoveryCode,
  );

  if (!currentPassword || currentPassword.length < 8) {
    return fail("Current password must be at least 8 characters long.");
  }

  if (!code && !recoveryCode) {
    return fail("Provide either a 6-digit code or a recovery code.");
  }

  if (code && !/^\d{6}$/.test(code)) {
    return fail("A valid 6-digit verification code is required.");
  }

  if (recoveryCode && recoveryCode.length < 6) {
    return fail("Recovery code is invalid.");
  }

  return success({
    currentPassword,
    ...(code ? { code } : {}),
    ...(recoveryCode ? { recoveryCode } : {}),
  });
}

export function validateTwoFactorVerifyLoginPayload(
  input: unknown,
): ValidationResult<TwoFactorVerifyLoginRequest> {
  if (!input || typeof input !== "object") {
    return fail("Two-factor login verification payload is required.");
  }

  const challengeToken = normalizeString(
    (input as Record<string, unknown>).challengeToken,
  );
  const code = normalizeString((input as Record<string, unknown>).code);
  const recoveryCode = normalizeString(
    (input as Record<string, unknown>).recoveryCode,
  );

  if (!challengeToken) {
    return fail("Challenge token is required.");
  }

  if (!code && !recoveryCode) {
    return fail("Provide either a 6-digit code or a recovery code.");
  }

  if (code && !/^\d{6}$/.test(code)) {
    return fail("A valid 6-digit verification code is required.");
  }

  if (recoveryCode && recoveryCode.length < 6) {
    return fail("Recovery code is invalid.");
  }

  return success({
    challengeToken,
    ...(code ? { code } : {}),
    ...(recoveryCode ? { recoveryCode } : {}),
  });
}

export function validateRevokeSessionPayload(
  input: unknown,
): ValidationResult<RevokeSessionRequest> {
  if (!input || typeof input !== "object") {
    return fail("Session revoke payload is required.");
  }

  const sessionId = normalizeString((input as Record<string, unknown>).sessionId);

  if (!sessionId) {
    return fail("Session identifier is required.");
  }

  return success({ sessionId });
}
