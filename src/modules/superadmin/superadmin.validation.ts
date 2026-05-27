import type { ValidationResult } from "../auth/auth.types.js";
import { normalizeCompanyModules } from "../companies/companies.types.js";
import { isUserAccountStatus } from "../users/users.types.js";
import {
  isMaintenanceScope,
  normalizeMaintenanceTargets,
} from "./maintenance-mode.js";
import type {
  CreateSuperadminAdminRequest,
  SetSuperadminAdminPasswordRequest,
  UnassignSuperadminAdminRequest,
  UpdateSuperadminAdminRequest,
  UpdateSuperadminSettingsRequest,
} from "./superadmin.types.js";

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

function isPhoneNumber(value: string) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
}

function normalizePlatformDomain(value: string) {
  try {
    const candidate = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function isSupportedTimezone(value: string) {
  if (!value) {
    return false;
  }

  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone").includes(value);
    }
  } catch {
    return value.includes("/");
  }

  return value.includes("/");
}

function isSupportedDateFormat(value: string) {
  return ["dd MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"].includes(value);
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizePositiveInteger(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeMaintenanceTargetList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return normalizeMaintenanceTargets(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim()),
  );
}

export function validateCreateAdminPayload(
  input: unknown,
): ValidationResult<CreateSuperadminAdminRequest> {
  if (!input || typeof input !== "object") {
    return fail("Admin payload is required.");
  }

  const fullName = normalizeString((input as Record<string, unknown>).fullName);
  const email = normalizeString((input as Record<string, unknown>).email).toLowerCase();
  const password = normalizeString((input as Record<string, unknown>).password);
  const status = normalizeString((input as Record<string, unknown>).status).toLowerCase();
  const companyId = normalizeString((input as Record<string, unknown>).companyId);

  if (!fullName || fullName.length < 2) {
    return fail("Full name must be at least 2 characters long.");
  }

  if (!email || !isEmail(email)) {
    return fail("A valid email address is required.");
  }

  if (!password || password.length < 8) {
    return fail("Password must be at least 8 characters long.");
  }

  if (!isUserAccountStatus(status)) {
    return fail("A valid admin status is required.");
  }

  if (companyId && status !== "active") {
    return fail("Only active admins can be assigned to a company.");
  }

  return success({
    fullName,
    email,
    password,
    status,
    companyId: companyId || undefined,
  });
}

export function validateUpdateAdminPayload(
  input: unknown,
): ValidationResult<UpdateSuperadminAdminRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Admin update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one editable admin field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !["fullName", "email", "phone"].includes(key),
  );

  if (invalidKeys.length > 0) {
    return fail("Only fullName, email, and phone can be updated here.");
  }

  const data: UpdateSuperadminAdminRequest = {};
  const errors: string[] = [];

  if ("fullName" in payload) {
    const fullName = normalizeString(payload.fullName);

    if (!fullName || fullName.length < 2) {
      errors.push("Full name must be at least 2 characters long.");
    } else {
      data.fullName = fullName;
    }
  }

  if ("email" in payload) {
    const email = normalizeString(payload.email).toLowerCase();

    if (!email || !isEmail(email)) {
      errors.push("A valid email address is required.");
    } else {
      data.email = email;
    }
  }

  if ("phone" in payload) {
    const rawPhone = payload.phone;
    const phone =
      rawPhone === null ? null : typeof rawPhone === "string" ? rawPhone.trim() : undefined;

    if (phone === undefined) {
      errors.push("Phone must be a string value.");
    } else if (phone && !isPhoneNumber(phone)) {
      errors.push(
        "Phone must contain 7 to 20 characters using digits and standard phone symbols only.",
      );
    } else {
      data.phone = phone || null;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateSetAdminPasswordPayload(
  input: unknown,
): ValidationResult<SetSuperadminAdminPasswordRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Password payload is required.");
  }

  const newPassword = normalizeString(
    (input as Record<string, unknown>).newPassword,
  );
  const confirmPassword = normalizeString(
    (input as Record<string, unknown>).confirmPassword,
  );

  if (!newPassword || newPassword.length < 8) {
    return fail("New password must be at least 8 characters long.");
  }

  if (newPassword !== confirmPassword) {
    return fail("Password confirmation does not match.");
  }

  return success({
    newPassword,
    confirmPassword,
  });
}

export function validateUnassignAdminPayload(
  input: unknown,
): ValidationResult<UnassignSuperadminAdminRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Admin unassignment payload is required.");
  }

  const companyId = normalizeString((input as Record<string, unknown>).companyId);

  if (!companyId) {
    return fail("A company identifier is required.");
  }

  return success({ companyId });
}

export function validateUpdateSuperadminSettingsPayload(
  input: unknown,
): ValidationResult<UpdateSuperadminSettingsRequest> {
  if (!input || typeof input !== "object") {
    return fail("Settings payload is required.");
  }

  const record = input as Record<string, unknown>;
  const general =
    record.general && typeof record.general === "object"
      ? (record.general as Record<string, unknown>)
      : null;
  const security =
    record.security && typeof record.security === "object"
      ? (record.security as Record<string, unknown>)
      : null;
  const notifications =
    record.notifications && typeof record.notifications === "object"
      ? (record.notifications as Record<string, unknown>)
      : null;
  const modules =
    record.modules && typeof record.modules === "object"
      ? (record.modules as Record<string, unknown>)
      : null;
  const operations =
    record.operations && typeof record.operations === "object"
      ? (record.operations as Record<string, unknown>)
      : null;

  if (!general || !security || !notifications || !modules || !operations) {
    return fail("All superadmin settings sections are required.");
  }

  const platformName = normalizeString(general.platformName);
  const rawPlatformDomain = normalizeString(general.platformDomain);
  const supportEmail = normalizeString(general.supportEmail).toLowerCase();
  const timezone = normalizeString(general.timezone);
  const dateFormat = normalizeString(general.dateFormat);
  const minimumPasswordLength = normalizePositiveInteger(
    security.minimumPasswordLength,
  );
  const enforceGlobalMfa = normalizeBoolean(security.enforceGlobalMfa);
  const googleSsoEnabled = normalizeBoolean(security.googleSsoEnabled);
  const samlSsoEnabled = normalizeBoolean(security.samlSsoEnabled);
  const requireUppercase = normalizeBoolean(security.requireUppercase);
  const requireNumber = normalizeBoolean(security.requireNumber);
  const requireSpecialCharacter = normalizeBoolean(
    security.requireSpecialCharacter,
  );
  const sessionTimeoutMinutes = normalizePositiveInteger(
    security.sessionTimeoutMinutes,
  );
  const companyUserCreated = normalizeBoolean(notifications.companyUserCreated);
  const assetAssigned = normalizeBoolean(notifications.assetAssigned);
  const leaveStatusChanged = normalizeBoolean(notifications.leaveStatusChanged);
  const procurementCreated = normalizeBoolean(notifications.procurementCreated);
  const defaultEnabledModules = Array.isArray(modules.defaultEnabledModules)
    ? normalizeCompanyModules(
        modules.defaultEnabledModules.map((value) => normalizeString(value)),
      )
    : null;
  const maintenanceMode = normalizeBoolean(operations.maintenanceMode);
  const maintenanceScope = normalizeString(operations.maintenanceScope).toLowerCase();
  const maintenanceTargets = normalizeMaintenanceTargetList(
    operations.maintenanceTargets,
  );

  if (!platformName || platformName.length < 2 || platformName.length > 120) {
    return fail("Platform name must be between 2 and 120 characters.");
  }

  const platformDomain = rawPlatformDomain
    ? normalizePlatformDomain(rawPlatformDomain)
    : null;

  if (!platformDomain) {
    return fail("Platform domain must be a valid http or https URL.");
  }

  if (!supportEmail || !isEmail(supportEmail)) {
    return fail("A valid support email address is required.");
  }

  if (!timezone) {
    return fail("Timezone is required.");
  }

  if (!isSupportedTimezone(timezone)) {
    return fail("Timezone must be a supported IANA timezone value.");
  }

  if (!dateFormat) {
    return fail("Date format is required.");
  }

  if (!isSupportedDateFormat(dateFormat)) {
    return fail("Date format must be one of the supported platform formats.");
  }

  if (
    minimumPasswordLength === null ||
    minimumPasswordLength < 8 ||
    minimumPasswordLength > 128
  ) {
    return fail("Minimum password length must be between 8 and 128 characters.");
  }

  if (
    enforceGlobalMfa === null ||
    googleSsoEnabled === null ||
    samlSsoEnabled === null ||
    requireUppercase === null ||
    requireNumber === null ||
    requireSpecialCharacter === null
  ) {
    return fail("Security toggles must be valid boolean values.");
  }

  if (
    sessionTimeoutMinutes === null ||
    sessionTimeoutMinutes < 15 ||
    sessionTimeoutMinutes > 1440
  ) {
    return fail("Session timeout must be between 15 and 1440 minutes.");
  }

  if (
    companyUserCreated === null ||
    assetAssigned === null ||
    leaveStatusChanged === null ||
    procurementCreated === null
  ) {
    return fail("Notification toggles must be valid boolean values.");
  }

  if (!defaultEnabledModules) {
    return fail("Default enabled modules must be an array.");
  }

  if (maintenanceMode === null) {
    return fail("Maintenance mode must be a valid boolean value.");
  }

  if (!isMaintenanceScope(maintenanceScope)) {
    return fail("Maintenance scope must be either 'all' or 'selected'.");
  }

  if (maintenanceTargets === null) {
    return fail("Maintenance targets must be provided as an array.");
  }

  if (
    maintenanceMode &&
    maintenanceScope === "selected" &&
    maintenanceTargets.length === 0
  ) {
    return fail("Select at least one dashboard before enabling targeted maintenance mode.");
  }

  return success({
    general: {
      platformName,
      platformDomain,
      supportEmail,
      timezone,
      dateFormat,
    },
    security: {
      minimumPasswordLength,
      enforceGlobalMfa,
      googleSsoEnabled,
      samlSsoEnabled,
      requireUppercase,
      requireNumber,
      requireSpecialCharacter,
      sessionTimeoutMinutes,
    },
    notifications: {
      companyUserCreated,
      assetAssigned,
      leaveStatusChanged,
      procurementCreated,
    },
    modules: {
      defaultEnabledModules,
    },
    operations: {
      maintenanceMode,
      maintenanceScope,
      maintenanceTargets,
    },
  });
}
