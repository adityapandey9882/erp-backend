import type { ValidationResult } from "../auth/auth.types.js";
import {
  ADMIN_WEEKDAY_KEYS,
  BIOMETRIC_CONNECTION_TYPES,
  BIOMETRIC_DEVICE_TYPES,
  PAYROLL_CYCLE_TYPES,
  type AdminWeekdayKey,
  type BiometricConnectionType,
  type BiometricDeviceType,
  type PayrollCycleType,
} from "./admin-settings.types.js";

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

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWeekday(value: string): value is AdminWeekdayKey {
  return ADMIN_WEEKDAY_KEYS.includes(value as AdminWeekdayKey);
}

function isValidDeviceType(value: string): value is BiometricDeviceType {
  return BIOMETRIC_DEVICE_TYPES.includes(value as BiometricDeviceType);
}

function isValidConnectionType(value: string): value is BiometricConnectionType {
  return BIOMETRIC_CONNECTION_TYPES.includes(value as BiometricConnectionType);
}

function isValidPayrollCycle(value: string): value is PayrollCycleType {
  return PAYROLL_CYCLE_TYPES.includes(value as PayrollCycleType);
}

export type UpdateAdminCompanyProfileRequest = {
  companyName: string;
  legalName: string | null;
  cin: string | null;
  gstin: string | null;
  pan: string | null;
  industry: string;
  companySize: string | null;
  website: string | null;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  logoUrl: string | null;
};

export type CreateAdminOfficeLocationRequest = {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  isPrimary: boolean;
  isActive: boolean;
};

export type UpdateAdminOfficeLocationRequest = CreateAdminOfficeLocationRequest;

export type CreateAdminSiteLocationRequest = {
  name: string;
  clientName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  projectId: string | null;
  assignedEmployeeIds: string[];
  isActive: boolean;
};

export type UpdateAdminSiteLocationRequest = CreateAdminSiteLocationRequest;

export type CaptureAdminLocationSessionRequest = {
  token: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export type UpdateAdminAttendanceSettingsRequest = {
  defaultShiftStart: string;
  defaultShiftEnd: string;
  graceTimeMinutes: number;
  halfDayThresholdMinutes: number;
  fullDayThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  weeklyOffDays: AdminWeekdayKey[];
  geofenceRequired: boolean;
  allowBrowserGpsFallback: boolean;
  remoteAttendanceAllowed: boolean;
  fieldVisitAttendanceAllowed: boolean;
  breakTrackingAllowed: boolean;
};

export type CreateAdminBiometricDeviceRequest = {
  name: string;
  officeLocationId: string | null;
  deviceType: BiometricDeviceType;
  ipAddress: string | null;
  port: number | null;
  serialNumber: string | null;
  connectionType: BiometricConnectionType;
  syncIntervalMinutes: number;
  isActive: boolean;
};

export type UpdateAdminBiometricDeviceRequest = CreateAdminBiometricDeviceRequest;

export type UpdateAdminPayrollSettingsRequest = {
  salaryComponents: string[];
  earningsComponents: string[];
  deductionComponents: string[];
  pfEnabled: boolean;
  esiEnabled: boolean;
  ptEnabled: boolean;
  salaryCycle: PayrollCycleType;
  payrollLockDay: number;
  payslipPublishDay: number;
  overtimeRateRule: string;
  unpaidLeaveDeductionRule: string;
};

export type UpdateAdminNotificationSettingsRequest = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  attendanceAlerts: boolean;
  leaveApprovalAlerts: boolean;
  payrollAlerts: boolean;
  announcementAlerts: boolean;
};

export function validateUpdateAdminCompanyProfilePayload(
  input: unknown,
): ValidationResult<UpdateAdminCompanyProfileRequest> {
  if (!input || typeof input !== "object") {
    return fail("Company profile payload is required.");
  }

  const record = input as Record<string, unknown>;
  const companyName = normalizeString(record.companyName);
  const industry = normalizeString(record.industry);
  const email = normalizeString(record.email).toLowerCase();

  if (companyName.length < 2) {
    return fail("Company name must be at least 2 characters long.");
  }

  if (industry.length < 2) {
    return fail("Industry must be at least 2 characters long.");
  }

  if (!isValidEmail(email)) {
    return fail("Company email must be a valid email address.");
  }

  return success({
    companyName,
    legalName: normalizeOptionalString(record.legalName),
    cin: normalizeOptionalString(record.cin),
    gstin: normalizeOptionalString(record.gstin),
    pan: normalizeOptionalString(record.pan),
    industry,
    companySize: normalizeOptionalString(record.companySize),
    website: normalizeOptionalString(record.website),
    email,
    phone: normalizeOptionalString(record.phone),
    addressLine1: normalizeOptionalString(record.addressLine1),
    addressLine2: normalizeOptionalString(record.addressLine2),
    city: normalizeOptionalString(record.city),
    state: normalizeOptionalString(record.state),
    country: normalizeOptionalString(record.country),
    postalCode: normalizeOptionalString(record.postalCode),
    logoUrl: normalizeOptionalString(record.logoUrl),
  });
}

function validateOfficeLocationLikePayload(
  input: unknown,
): ValidationResult<CreateAdminOfficeLocationRequest | UpdateAdminOfficeLocationRequest> {
  if (!input || typeof input !== "object") {
    return fail("Office location payload is required.");
  }

  const record = input as Record<string, unknown>;
  const name = normalizeString(record.name);
  const latitude = normalizeOptionalNumber(record.latitude);
  const longitude = normalizeOptionalNumber(record.longitude);
  const geofenceRadiusMeters = normalizeOptionalNumber(record.geofenceRadiusMeters);
  const isActive = normalizeBoolean(record.isActive, true);
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;

  if (name.length < 2) {
    return fail("Office name must be at least 2 characters long.");
  }

  if (geofenceRadiusMeters === null || !Number.isFinite(geofenceRadiusMeters)) {
    return fail("Geofence radius must be a valid number.");
  }

  if (geofenceRadiusMeters < 20) {
    return fail("Geofence radius must be at least 20 meters.");
  }

  if (hasLatitude !== hasLongitude) {
    return fail("Latitude and longitude must be provided together.");
  }

  if (isActive && (!hasLatitude || !hasLongitude)) {
    return fail("Latitude and longitude are required for active office locations.");
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return fail("Latitude must be between -90 and 90.");
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return fail("Longitude must be between -180 and 180.");
  }

  if (
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) < 0.05 &&
    Math.abs(longitude) < 0.05
  ) {
    return fail("Latitude and longitude cannot be near 0,0 for an office location.");
  }

  return success({
    name,
    address: normalizeOptionalString(record.address),
    city: normalizeOptionalString(record.city),
    state: normalizeOptionalString(record.state),
    country: normalizeOptionalString(record.country),
    latitude,
    longitude,
    geofenceRadiusMeters,
    isPrimary: normalizeBoolean(record.isPrimary),
    isActive,
  });
}

function validateSiteLocationLikePayload(
  input: unknown,
): ValidationResult<CreateAdminSiteLocationRequest | UpdateAdminSiteLocationRequest> {
  if (!input || typeof input !== "object") {
    return fail("Site location payload is required.");
  }

  const record = input as Record<string, unknown>;
  const name = normalizeString(record.name);
  const latitude = normalizeOptionalNumber(record.latitude);
  const longitude = normalizeOptionalNumber(record.longitude);
  const geofenceRadiusMeters = normalizeOptionalNumber(record.geofenceRadiusMeters);

  if (name.length < 2) {
    return fail("Site name must be at least 2 characters long.");
  }

  if (latitude === null || longitude === null) {
    return fail("Latitude and longitude are required for site locations.");
  }

  if (latitude < -90 || latitude > 90) {
    return fail("Latitude must be between -90 and 90.");
  }

  if (longitude < -180 || longitude > 180) {
    return fail("Longitude must be between -180 and 180.");
  }

  if (Math.abs(latitude) < 0.05 && Math.abs(longitude) < 0.05) {
    return fail("Latitude and longitude cannot point near 0,0.");
  }

  if (geofenceRadiusMeters === null || !Number.isFinite(geofenceRadiusMeters)) {
    return fail("Site geofence radius must be a valid number.");
  }

  if (geofenceRadiusMeters < 20) {
    return fail("Site geofence radius must be at least 20 meters.");
  }

  return success({
    name,
    clientName: normalizeOptionalString(record.clientName),
    address: normalizeOptionalString(record.address),
    city: normalizeOptionalString(record.city),
    state: normalizeOptionalString(record.state),
    country: normalizeOptionalString(record.country),
    latitude,
    longitude,
    geofenceRadiusMeters,
    projectId: normalizeOptionalString(record.projectId),
    assignedEmployeeIds: Array.from(new Set(normalizeStringArray(record.assignedEmployeeIds))),
    isActive: normalizeBoolean(record.isActive, true),
  });
}

export function validateCreateAdminOfficeLocationPayload(
  input: unknown,
): ValidationResult<CreateAdminOfficeLocationRequest> {
  return validateOfficeLocationLikePayload(input) as ValidationResult<CreateAdminOfficeLocationRequest>;
}

export function validateUpdateAdminOfficeLocationPayload(
  input: unknown,
): ValidationResult<UpdateAdminOfficeLocationRequest> {
  return validateOfficeLocationLikePayload(input) as ValidationResult<UpdateAdminOfficeLocationRequest>;
}

export function validateCreateAdminSiteLocationPayload(
  input: unknown,
): ValidationResult<CreateAdminSiteLocationRequest> {
  return validateSiteLocationLikePayload(input) as ValidationResult<CreateAdminSiteLocationRequest>;
}

export function validateUpdateAdminSiteLocationPayload(
  input: unknown,
): ValidationResult<UpdateAdminSiteLocationRequest> {
  return validateSiteLocationLikePayload(input) as ValidationResult<UpdateAdminSiteLocationRequest>;
}

export function validateCaptureAdminLocationSessionPayload(
  input: unknown,
): ValidationResult<CaptureAdminLocationSessionRequest> {
  if (!input || typeof input !== "object") {
    return fail("Location capture payload is required.");
  }

  const record = input as Record<string, unknown>;
  const token = normalizeString(record.token);
  const latitude = normalizeOptionalNumber(record.latitude);
  const longitude = normalizeOptionalNumber(record.longitude);
  const accuracy = normalizeOptionalNumber(record.accuracy);

  if (token.length < 16) {
    return fail("A valid capture token is required.");
  }

  if (latitude === null || longitude === null) {
    return fail("Latitude and longitude are required.");
  }

  if (latitude < -90 || latitude > 90) {
    return fail("Latitude must be between -90 and 90.");
  }

  if (longitude < -180 || longitude > 180) {
    return fail("Longitude must be between -180 and 180.");
  }

  if (Math.abs(latitude) < 0.05 && Math.abs(longitude) < 0.05) {
    return fail("Latitude and longitude cannot be near 0,0.");
  }

  if (accuracy === null || !Number.isFinite(accuracy) || accuracy <= 0) {
    return fail("Accuracy must be a positive number.");
  }

  return success({
    token,
    latitude,
    longitude,
    accuracy,
    address: normalizeOptionalString(record.address),
    city: normalizeOptionalString(record.city),
    state: normalizeOptionalString(record.state),
    country: normalizeOptionalString(record.country),
  });
}

export function validateUpdateAdminAttendanceSettingsPayload(
  input: unknown,
): ValidationResult<UpdateAdminAttendanceSettingsRequest> {
  if (!input || typeof input !== "object") {
    return fail("Attendance settings payload is required.");
  }

  const record = input as Record<string, unknown>;
  const defaultShiftStart = normalizeString(record.defaultShiftStart);
  const defaultShiftEnd = normalizeString(record.defaultShiftEnd);
  const graceTimeMinutes = normalizeOptionalNumber(record.graceTimeMinutes);
  const halfDayThresholdMinutes = normalizeOptionalNumber(record.halfDayThresholdMinutes);
  const fullDayThresholdMinutes = normalizeOptionalNumber(record.fullDayThresholdMinutes);
  const overtimeThresholdMinutes = normalizeOptionalNumber(record.overtimeThresholdMinutes);
  const weeklyOffDays = Array.from(
    new Set(normalizeStringArray(record.weeklyOffDays).filter(isValidWeekday)),
  );

  if (!/^\d{2}:\d{2}$/.test(defaultShiftStart) || !/^\d{2}:\d{2}$/.test(defaultShiftEnd)) {
    return fail("Default shift start and end must use HH:MM format.");
  }

  if (
    graceTimeMinutes === null ||
    halfDayThresholdMinutes === null ||
    fullDayThresholdMinutes === null ||
    overtimeThresholdMinutes === null
  ) {
    return fail("Attendance thresholds must be valid numbers.");
  }

  if (weeklyOffDays.length === 0) {
    return fail("Select at least one weekly off day.");
  }

  return success({
    defaultShiftStart,
    defaultShiftEnd,
    graceTimeMinutes,
    halfDayThresholdMinutes,
    fullDayThresholdMinutes,
    overtimeThresholdMinutes,
    weeklyOffDays,
    geofenceRequired: normalizeBoolean(record.geofenceRequired, true),
    allowBrowserGpsFallback: normalizeBoolean(record.allowBrowserGpsFallback),
    remoteAttendanceAllowed: normalizeBoolean(record.remoteAttendanceAllowed),
    fieldVisitAttendanceAllowed: normalizeBoolean(record.fieldVisitAttendanceAllowed),
    breakTrackingAllowed: normalizeBoolean(record.breakTrackingAllowed),
  });
}

function validateBiometricDeviceLikePayload(
  input: unknown,
): ValidationResult<CreateAdminBiometricDeviceRequest | UpdateAdminBiometricDeviceRequest> {
  if (!input || typeof input !== "object") {
    return fail("Biometric device payload is required.");
  }

  const record = input as Record<string, unknown>;
  const name = normalizeString(record.name);
  const deviceType = normalizeString(record.deviceType);
  const connectionType = normalizeString(record.connectionType);
  const syncIntervalMinutes = normalizeOptionalNumber(record.syncIntervalMinutes);
  const port = normalizeOptionalNumber(record.port);

  if (name.length < 2) {
    return fail("Device name must be at least 2 characters long.");
  }

  if (!isValidDeviceType(deviceType)) {
    return fail("Device type must be fingerprint, face, or RFID.");
  }

  if (!isValidConnectionType(connectionType)) {
    return fail("Connection type must be lan, wan, cloud, or usb.");
  }

  if (
    syncIntervalMinutes === null ||
    syncIntervalMinutes < 1 ||
    syncIntervalMinutes > 1440
  ) {
    return fail("Sync interval must be between 1 and 1440 minutes.");
  }

  if (port !== null && (port < 1 || port > 65535)) {
    return fail("Port must be between 1 and 65535.");
  }

  return success({
    name,
    officeLocationId: normalizeOptionalString(record.officeLocationId),
    deviceType,
    ipAddress: normalizeOptionalString(record.ipAddress),
    port,
    serialNumber: normalizeOptionalString(record.serialNumber),
    connectionType,
    syncIntervalMinutes,
    isActive: normalizeBoolean(record.isActive, true),
  });
}

export function validateCreateAdminBiometricDevicePayload(
  input: unknown,
): ValidationResult<CreateAdminBiometricDeviceRequest> {
  return validateBiometricDeviceLikePayload(input) as ValidationResult<CreateAdminBiometricDeviceRequest>;
}

export function validateUpdateAdminBiometricDevicePayload(
  input: unknown,
): ValidationResult<UpdateAdminBiometricDeviceRequest> {
  return validateBiometricDeviceLikePayload(input) as ValidationResult<UpdateAdminBiometricDeviceRequest>;
}

export function validateUpdateAdminPayrollSettingsPayload(
  input: unknown,
): ValidationResult<UpdateAdminPayrollSettingsRequest> {
  if (!input || typeof input !== "object") {
    return fail("Payroll settings payload is required.");
  }

  const record = input as Record<string, unknown>;
  const salaryCycle = normalizeString(record.salaryCycle);
  const payrollLockDay = normalizeOptionalNumber(record.payrollLockDay);
  const payslipPublishDay = normalizeOptionalNumber(record.payslipPublishDay);
  const overtimeRateRule = normalizeString(record.overtimeRateRule);
  const unpaidLeaveDeductionRule = normalizeString(record.unpaidLeaveDeductionRule);

  if (!isValidPayrollCycle(salaryCycle)) {
    return fail("Salary cycle must be monthly, semi-monthly, or weekly.");
  }

  if (
    payrollLockDay === null ||
    payrollLockDay < 1 ||
    payrollLockDay > 31 ||
    payslipPublishDay === null ||
    payslipPublishDay < 1 ||
    payslipPublishDay > 31
  ) {
    return fail("Payroll lock day and payslip publish day must be between 1 and 31.");
  }

  if (overtimeRateRule.length < 2 || unpaidLeaveDeductionRule.length < 2) {
    return fail("Payroll rule summaries must be at least 2 characters long.");
  }

  return success({
    salaryComponents: normalizeStringArray(record.salaryComponents),
    earningsComponents: normalizeStringArray(record.earningsComponents),
    deductionComponents: normalizeStringArray(record.deductionComponents),
    pfEnabled: normalizeBoolean(record.pfEnabled),
    esiEnabled: normalizeBoolean(record.esiEnabled),
    ptEnabled: normalizeBoolean(record.ptEnabled),
    salaryCycle,
    payrollLockDay,
    payslipPublishDay,
    overtimeRateRule,
    unpaidLeaveDeductionRule,
  });
}

export function validateUpdateAdminNotificationSettingsPayload(
  input: unknown,
): ValidationResult<UpdateAdminNotificationSettingsRequest> {
  if (!input || typeof input !== "object") {
    return fail("Notification settings payload is required.");
  }

  const record = input as Record<string, unknown>;

  return success({
    emailNotifications: normalizeBoolean(record.emailNotifications, true),
    smsNotifications: normalizeBoolean(record.smsNotifications),
    inAppNotifications: normalizeBoolean(record.inAppNotifications, true),
    attendanceAlerts: normalizeBoolean(record.attendanceAlerts, true),
    leaveApprovalAlerts: normalizeBoolean(record.leaveApprovalAlerts, true),
    payrollAlerts: normalizeBoolean(record.payrollAlerts, true),
    announcementAlerts: normalizeBoolean(record.announcementAlerts, true),
  });
}
