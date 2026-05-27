import type { CompanyOnboardingStatus, CompanyStatus } from "../companies/companies.types.js";
import type { CompanyPolicySection } from "../policies/policies.types.js";

export const ADMIN_WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type AdminWeekdayKey = (typeof ADMIN_WEEKDAY_KEYS)[number];

export const BIOMETRIC_DEVICE_TYPES = ["fingerprint", "face", "rfid"] as const;
export type BiometricDeviceType = (typeof BIOMETRIC_DEVICE_TYPES)[number];

export const BIOMETRIC_CONNECTION_TYPES = [
  "lan",
  "wan",
  "cloud",
  "usb",
] as const;
export type BiometricConnectionType =
  (typeof BIOMETRIC_CONNECTION_TYPES)[number];

export const BIOMETRIC_SYNC_STATUSES = [
  "pending",
  "success",
  "failed",
] as const;
export type BiometricSyncStatus = (typeof BIOMETRIC_SYNC_STATUSES)[number];

export const BIOMETRIC_DEVICE_STATUSES = [
  "online",
  "offline",
  "inactive",
] as const;
export type BiometricDeviceStatus =
  (typeof BIOMETRIC_DEVICE_STATUSES)[number];

export const PAYROLL_CYCLE_TYPES = [
  "monthly",
  "semi-monthly",
  "weekly",
] as const;
export type PayrollCycleType = (typeof PAYROLL_CYCLE_TYPES)[number];

export type AdminCompanyProfileSettings = {
  companyId: string;
  companyName: string;
  code: string;
  status: CompanyStatus;
  onboardingStatus: CompanyOnboardingStatus;
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
  updatedAt: string;
};

export type AdminOfficeLocationView = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export type AdminSiteLocationEmployeeOption = {
  id: string;
  fullName: string;
  email: string;
};

export type AdminSiteLocationProjectOption = {
  id: string;
  name: string;
  code: string;
  clientName: string | null;
};

export type AdminSiteLocationView = {
  id: string;
  name: string;
  clientName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  isActive: boolean;
  assignedEmployees: AdminSiteLocationEmployeeOption[];
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_LOCATION_CAPTURE_SESSION_STATUSES = [
  "pending",
  "captured",
  "expired",
  "failed",
  "cancelled",
] as const;

export type AdminLocationCaptureSessionStatus =
  (typeof ADMIN_LOCATION_CAPTURE_SESSION_STATUSES)[number];

export type AdminLocationCaptureSession = {
  id: string;
  companyId: string;
  adminUserId: string;
  status: AdminLocationCaptureSessionStatus;
  tokenHash: string;
  expiresAt: string;
  capturedAt: string | null;
  capturedLatitude: number | null;
  capturedLongitude: number | null;
  capturedAccuracyMeters: number | null;
  capturedAddress: string | null;
  capturedCity: string | null;
  capturedState: string | null;
  capturedCountry: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminLocationCaptureSessionCreateResponse = {
  sessionId: string;
  status: AdminLocationCaptureSessionStatus;
  expiresAt: string;
  rawToken: string;
};

export type AdminLocationCaptureSessionStatusResponse = {
  sessionId: string;
  status: AdminLocationCaptureSessionStatus;
  expiresAt: string;
  capturedAt: string | null;
  failureReason: string | null;
  capturedLocation: {
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
};

export type AdminLocationCaptureSessionCancelResponse = {
  message: string;
  sessionId: string;
  status: AdminLocationCaptureSessionStatus;
};

export type AdminLocationCaptureSessionCaptureResponse = {
  message: string;
  status: AdminLocationCaptureSessionStatus;
  capturedAt: string | null;
  capturedLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
};

export type AdminAttendanceSettingsView = {
  companyId: string;
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
  updatedAt: string;
};

export type AdminBiometricDeviceView = {
  id: string;
  name: string;
  status: BiometricDeviceStatus;
  officeLocationId: string | null;
  officeLocationName: string | null;
  deviceType: BiometricDeviceType;
  ipAddress: string | null;
  port: number | null;
  serialNumber: string | null;
  connectionType: BiometricConnectionType;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: BiometricSyncStatus;
  isActive: boolean;
  updatedAt: string;
};

export type AdminPayrollSettingsView = {
  companyId: string;
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
  updatedAt: string;
};

export type AdminNotificationSettingsView = {
  companyId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  attendanceAlerts: boolean;
  leaveApprovalAlerts: boolean;
  payrollAlerts: boolean;
  announcementAlerts: boolean;
  updatedAt: string;
};

export type AdminSecuritySettingsView = {
  controlledBy: "superadmin";
  enforceGlobalMfa: boolean;
  sessionTimeoutMinutes: number;
  minimumPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  loginSecurityStatus: "protected" | "standard";
  note: string;
};

export type AdminSettingsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  companyProfile: AdminCompanyProfileSettings;
  officeLocations: AdminOfficeLocationView[];
  siteLocations: AdminSiteLocationListResponse;
  attendanceSettings: AdminAttendanceSettingsView;
  biometricDevices: AdminBiometricDeviceView[];
  leavePolicies: CompanyPolicySection[];
  payrollSettings: AdminPayrollSettingsView;
  notificationSettings: AdminNotificationSettingsView;
  securitySettings: AdminSecuritySettingsView;
  summary: {
    officeCount: number;
    biometricDeviceCount: number;
    leavePolicyCount: number;
    payrollComponentCount: number;
    activeNotificationChannels: number;
    roleCount: number;
    documentCount: number;
  };
};

export type AdminCompanyProfileMutationResponse = {
  message: string;
  profile: AdminCompanyProfileSettings;
};

export type AdminOfficeLocationListResponse = {
  items: AdminOfficeLocationView[];
};

export type AdminSiteLocationListResponse = {
  items: AdminSiteLocationView[];
  projectOptions: AdminSiteLocationProjectOption[];
  employeeOptions: AdminSiteLocationEmployeeOption[];
};

export type AdminOfficeLocationMutationResponse = {
  message: string;
  officeLocation: AdminOfficeLocationView;
};

export type AdminSiteLocationMutationResponse = {
  message: string;
  siteLocation: AdminSiteLocationView;
};

export type AdminLocationCaptureSessionMutationResponse = {
  message: string;
  session: AdminLocationCaptureSession;
};

export type AdminAttendanceSettingsMutationResponse = {
  message: string;
  settings: AdminAttendanceSettingsView;
};

export type AdminBiometricDeviceListResponse = {
  items: AdminBiometricDeviceView[];
};

export type AdminBiometricDeviceMutationResponse = {
  message: string;
  device: AdminBiometricDeviceView;
};

export type AdminBiometricDeviceSyncResponse = {
  message: string;
  syncTriggered: boolean;
  device: AdminBiometricDeviceView;
};

export type AdminBiometricDeviceDeleteResponse = {
  message: string;
  device: AdminBiometricDeviceView;
};

export type AdminPayrollSettingsMutationResponse = {
  message: string;
  settings: AdminPayrollSettingsView;
};

export type AdminNotificationSettingsMutationResponse = {
  message: string;
  settings: AdminNotificationSettingsView;
};

export type AdminSettingsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 403 | 404 | 409;
      message: string;
    };
