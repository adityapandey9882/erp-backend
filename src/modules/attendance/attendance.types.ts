import type { CompanyStatus } from "../companies/companies.types.js";
import type { ShiftSummary } from "../shifts/shifts.types.js";
import type { CompanyUserProfile } from "../users/users.types.js";

export const ATTENDANCE_RECORD_STATUSES = [
  "checked-in",
  "present",
  "late",
  "half-day",
  "missing",
  "pending",
  "absent",
] as const;
export const ATTENDANCE_TODAY_STATES = [
  "blocked",
  "not-started",
  "checked-in",
  "completed",
] as const;
export const ATTENDANCE_SOURCES = [
  "biometric",
  "gps",
  "manual",
  "remote",
  "field",
] as const;
export const ATTENDANCE_VERIFICATION_SOURCES = [
  "gps_verified",
  "qr_mobile_gps",
  "field_site_gps",
] as const;
export const ATTENDANCE_MODE_KEYS = ["office", "remote", "field-visit"] as const;
export const BIOMETRIC_DEVICE_STATUSES = ["online", "offline", "inactive"] as const;
export const ATTENDANCE_QR_ACTIONS = ["check_in", "check_out"] as const;
export const ATTENDANCE_QR_SESSION_STATUSES = [
  "pending",
  "verified",
  "expired",
  "failed",
  "cancelled",
] as const;

export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number];
export type AttendanceTodayState = (typeof ATTENDANCE_TODAY_STATES)[number];
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];
export type AttendanceVerificationSource =
  (typeof ATTENDANCE_VERIFICATION_SOURCES)[number];
export type AttendanceModeKey = (typeof ATTENDANCE_MODE_KEYS)[number];
export type AttendanceLateStatus = "on-time" | "late" | "not-evaluated";
export type BiometricDeviceStatus = (typeof BIOMETRIC_DEVICE_STATUSES)[number];
export type AttendanceQrAction = (typeof ATTENDANCE_QR_ACTIONS)[number];
export type AttendanceQrSessionStatus =
  (typeof ATTENDANCE_QR_SESSION_STATUSES)[number];

export type AttendancePolicyContext = {
  allowManualEntry: boolean;
  manualCorrectionAllowed: boolean;
  lateThresholdMinutes: number;
  workHoursPerDay: number;
  workHoursReferenceMinutes: number;
  attendanceRoundingMode: string;
  enforcementNotes: string[];
};

export type AttendancePolicyEvaluation = {
  lateStatus: AttendanceLateStatus;
  lateByMinutes: number | null;
  workDurationDeltaMinutes: number | null;
  notes: string[];
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracyMeters: number | null;
  checkInDistanceMeters: number | null;
  checkInVerificationSource: AttendanceVerificationSource | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracyMeters: number | null;
  checkOutDistanceMeters: number | null;
  checkOutVerificationSource: AttendanceVerificationSource | null;
  status: AttendanceRecordStatus;
  source: AttendanceSource;
  locationId: string | null;
  locationName: string | null;
  siteLocationId: string | null;
  siteLocationName: string | null;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  notes: string | null;
  durationMinutes: number | null;
  policyEvaluation?: AttendancePolicyEvaluation;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceEmployeeSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role" | "status" | "department" | "designation"
> & {
  shift?: ShiftSummary | null;
};

export type EmployeeOfficeLocation = {
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
};

export type EmployeeSiteLocation = {
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
};

export type EmployeeAttendanceBiometricDevice = {
  id: string;
  name: string;
  status: BiometricDeviceStatus;
  officeLocationId: string | null;
  officeLocationName: string | null;
  deviceType: string;
  serialNumber: string | null;
  lastSyncAt: string | null;
  syncIntervalMinutes: number;
};

export type EmployeeAttendanceModeOption = {
  key: AttendanceModeKey;
  label: string;
  isAllowed: boolean;
  isEnabled: boolean;
  blockedReason: string | null;
};

export type EmployeeAttendanceConfig = {
  officeLocation: EmployeeOfficeLocation | null;
  officeLocationsConfigured: number;
  shiftAssigned: boolean;
  geofenceRequired: boolean;
  allowBrowserGpsFallback: boolean;
  breakTrackingAllowed: boolean;
  allowedModes: {
    office: boolean;
    remote: boolean;
    fieldVisit: boolean;
    biometric: boolean;
  };
  availableModes: EmployeeAttendanceModeOption[];
  biometricDevice: EmployeeAttendanceBiometricDevice | null;
  officeModeBlockedReason: string | null;
  checkInBlockedReason: string | null;
};

export type HrAttendanceEntry = AttendanceRecord & {
  employee: AttendanceEmployeeSummary;
};

export type HrAttendanceWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    totalRecords: number;
    recordsToday: number;
    activeEmployees: number;
    openSessions: number;
    completedSessions: number;
  };
  policy: AttendancePolicyContext;
  items: HrAttendanceEntry[];
};

export type EmployeeAttendanceWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  profile: AttendanceEmployeeSummary;
  summary: {
    totalRecords: number;
    recordsToday: number;
    completedSessions: number;
    openSessions: number;
    currentState: AttendanceTodayState;
    canCheckIn: boolean;
    canCheckOut: boolean;
    blockedReason: string | null;
  };
  policy: AttendancePolicyContext;
  assignedShift: ShiftSummary | null;
  config: EmployeeAttendanceConfig;
  today: AttendanceRecord | null;
  history: AttendanceRecord[];
};

export type EmployeeAttendancePunchRequest = {
  mode: AttendanceModeKey;
  officeLocationId: string | null;
  siteLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  notes: string | null;
  deviceId: string | null;
};

export type EmployeeAttendanceMutationResponse = {
  message: string;
  workspace: EmployeeAttendanceWorkspaceResponse;
};

export type AttendanceLocationProof = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  verificationSource: AttendanceVerificationSource;
};

export type EmployeeOfficeLocationListResponse = {
  items: EmployeeOfficeLocation[];
};

export type EmployeeSiteLocationListResponse = {
  items: EmployeeSiteLocation[];
};

export type CreateAttendanceQrSessionRequest = {
  action: AttendanceQrAction;
  officeLocationId: string | null;
};

export type VerifyAttendanceQrSessionRequest = {
  token: string;
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type AttendanceQrSession = {
  id: string;
  companyId: string;
  employeeId: string;
  officeLocationId: string;
  officeLocationName: string | null;
  officeLocationRadiusMeters: number | null;
  attendanceRecordId: string | null;
  action: AttendanceQrAction;
  status: AttendanceQrSessionStatus;
  tokenHash: string;
  expiresAt: string;
  verifiedAt: string | null;
  verifiedLatitude: number | null;
  verifiedLongitude: number | null;
  verifiedAccuracyMeters: number | null;
  verifiedDistanceMeters: number | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceQrSessionCreateResponse = {
  sessionId: string;
  action: AttendanceQrAction;
  status: AttendanceQrSessionStatus;
  qrUrl: string;
  qrCodeImage: string;
  expiresAt: string;
};

export type AttendanceQrVerifiedLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceMeters: number | null;
};

export type AttendanceQrSessionStatusResponse = {
  sessionId: string;
  action: AttendanceQrAction;
  status: AttendanceQrSessionStatus;
  expiresAt: string;
  verifiedAt: string | null;
  failureReason: string | null;
  officeLocation: {
    id: string;
    name: string | null;
    radiusMeters: number | null;
  };
  verifiedLocation: AttendanceQrVerifiedLocation | null;
  workspace: EmployeeAttendanceWorkspaceResponse | null;
};

export type AttendanceQrSessionCancelResponse = {
  message: string;
  sessionId: string;
  status: AttendanceQrSessionStatus;
};

export type AttendanceQrSessionVerifyResponse = {
  message: string;
  status: AttendanceQrSessionStatus;
  distanceMeters: number;
  allowedRadiusMeters: number | null;
  accuracyMeters: number | null;
  verifiedLocation: AttendanceQrVerifiedLocation;
  workspace: EmployeeAttendanceWorkspaceResponse;
};

export type AttendanceServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AttendanceServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type AttendanceServiceResult<T> =
  | AttendanceServiceSuccess<T>
  | AttendanceServiceFailure;
