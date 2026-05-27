import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../../database/index.js";
import type { DatabaseExecutor } from "../../database/query.js";
import {
  ADMIN_WEEKDAY_KEYS,
  ADMIN_LOCATION_CAPTURE_SESSION_STATUSES,
  BIOMETRIC_CONNECTION_TYPES,
  BIOMETRIC_DEVICE_STATUSES,
  BIOMETRIC_DEVICE_TYPES,
  BIOMETRIC_SYNC_STATUSES,
  PAYROLL_CYCLE_TYPES,
  type AdminAttendanceSettingsView,
  type AdminBiometricDeviceView,
  type AdminCompanyProfileSettings,
  type AdminLocationCaptureSession,
  type AdminLocationCaptureSessionStatus,
  type AdminNotificationSettingsView,
  type AdminOfficeLocationView,
  type AdminPayrollSettingsView,
  type AdminSiteLocationEmployeeOption,
  type AdminSiteLocationListResponse,
  type AdminSiteLocationProjectOption,
  type AdminSiteLocationView,
  type AdminWeekdayKey,
  type BiometricConnectionType,
  type BiometricDeviceStatus,
  type BiometricDeviceType,
  type BiometricSyncStatus,
  type PayrollCycleType,
} from "./admin-settings.types.js";
import {
  isCompanyOnboardingStatus,
  isCompanyStatus,
} from "../companies/companies.types.js";

type CompanyProfileRow = {
  companyId: string;
  companyName: string;
  code: string;
  status: string;
  onboardingStatus: string;
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
  updatedAt: Date | string;
};

type OfficeLocationRow = {
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
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SiteLocationRow = {
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
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SiteLocationAssignmentRow = {
  siteLocationId: string;
  id: string;
  fullName: string;
  email: string;
};

type SiteLocationProjectOptionRow = {
  id: string;
  name: string;
  code: string;
  clientName: string | null;
};

type SiteLocationEmployeeOptionRow = {
  id: string;
  fullName: string;
  email: string;
};

type SiteLocationMutationInput = {
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

type AdminLocationCaptureSessionRow = {
  id: string;
  companyId: string;
  adminUserId: string;
  status: AdminLocationCaptureSessionStatus;
  tokenHash: string;
  expiresAt: Date | string;
  capturedAt: Date | string | null;
  capturedLatitude: number | null;
  capturedLongitude: number | null;
  capturedAccuracyMeters: number | null;
  capturedAddress: string | null;
  capturedCity: string | null;
  capturedState: string | null;
  capturedCountry: string | null;
  failureReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AttendanceSettingsRow = {
  companyId: string;
  defaultShiftStart: string;
  defaultShiftEnd: string;
  graceTimeMinutes: number;
  halfDayThresholdMinutes: number;
  fullDayThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  weeklyOffDays: string[] | null;
  geofenceRequired: boolean;
  allowBrowserGpsFallback: boolean;
  remoteAttendanceAllowed: boolean;
  fieldVisitAttendanceAllowed: boolean;
  breakTrackingAllowed: boolean;
  updatedAt: Date | string;
};

type BiometricDeviceRow = {
  id: string;
  name: string;
  status: string;
  officeLocationId: string | null;
  officeLocationName: string | null;
  deviceType: string;
  ipAddress: string | null;
  port: number | null;
  serialNumber: string | null;
  connectionType: string;
  syncIntervalMinutes: number;
  lastSyncAt: Date | string | null;
  lastSyncStatus: string;
  isActive: boolean;
  updatedAt: Date | string;
};

type BiometricPunchLogRow = {
  id: string;
  userId: string | null;
  biometricIdentifier: string | null;
  punchTime: Date | string;
  punchType: string;
  rawPayload: Record<string, unknown>;
};

type PayrollSettingsRow = {
  companyId: string;
  salaryComponents: string[] | null;
  earningsComponents: string[] | null;
  deductionComponents: string[] | null;
  pfEnabled: boolean;
  esiEnabled: boolean;
  ptEnabled: boolean;
  salaryCycle: string;
  payrollLockDay: number;
  payslipPublishDay: number;
  overtimeRateRule: string;
  unpaidLeaveDeductionRule: string;
  updatedAt: Date | string;
};

type NotificationSettingsRow = {
  companyId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  attendanceAlerts: boolean;
  leaveApprovalAlerts: boolean;
  payrollAlerts: boolean;
  announcementAlerts: boolean;
  updatedAt: Date | string;
};

type SettingsSummaryRow = {
  officeCount: number;
  biometricDeviceCount: number;
  roleCount: number;
  documentCount: number;
};

const defaultExecutor: DatabaseExecutor = {
  query,
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isAdminWeekdayKey(value: string): value is AdminWeekdayKey {
  return ADMIN_WEEKDAY_KEYS.includes(value as AdminWeekdayKey);
}

function isBiometricDeviceType(value: string): value is BiometricDeviceType {
  return BIOMETRIC_DEVICE_TYPES.includes(value as BiometricDeviceType);
}

function isBiometricConnectionType(value: string): value is BiometricConnectionType {
  return BIOMETRIC_CONNECTION_TYPES.includes(value as BiometricConnectionType);
}

function isBiometricSyncStatus(value: string): value is BiometricSyncStatus {
  return BIOMETRIC_SYNC_STATUSES.includes(value as BiometricSyncStatus);
}

function isBiometricDeviceStatus(value: string): value is BiometricDeviceStatus {
  return BIOMETRIC_DEVICE_STATUSES.includes(value as BiometricDeviceStatus);
}

function isPayrollCycleType(value: string): value is PayrollCycleType {
  return PAYROLL_CYCLE_TYPES.includes(value as PayrollCycleType);
}

function isAdminLocationCaptureSessionStatus(
  value: string,
): value is AdminLocationCaptureSessionStatus {
  return ADMIN_LOCATION_CAPTURE_SESSION_STATUSES.includes(
    value as AdminLocationCaptureSessionStatus,
  );
}

function mapCompanyProfile(
  row: CompanyProfileRow | undefined,
): AdminCompanyProfileSettings | null {
  if (
    !row ||
    !isCompanyStatus(row.status) ||
    !isCompanyOnboardingStatus(row.onboardingStatus)
  ) {
    return null;
  }

  return {
    companyId: row.companyId,
    companyName: row.companyName,
    code: row.code,
    status: row.status,
    onboardingStatus: row.onboardingStatus,
    legalName: row.legalName,
    cin: row.cin,
    gstin: row.gstin,
    pan: row.pan,
    industry: row.industry,
    companySize: row.companySize,
    website: row.website,
    email: row.email,
    phone: row.phone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    country: row.country,
    postalCode: row.postalCode,
    logoUrl: row.logoUrl,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapOfficeLocation(
  row: OfficeLocationRow | undefined,
): AdminOfficeLocationView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    geofenceRadiusMeters: row.geofenceRadiusMeters,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapSiteLocationEmployeeOption(
  row: SiteLocationEmployeeOptionRow | SiteLocationAssignmentRow,
): AdminSiteLocationEmployeeOption {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
  };
}

function mapSiteLocationProjectOption(
  row: SiteLocationProjectOptionRow,
): AdminSiteLocationProjectOption {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    clientName: row.clientName,
  };
}

function mapSiteLocation(
  row: SiteLocationRow | undefined,
  assignmentsBySiteId = new Map<string, AdminSiteLocationEmployeeOption[]>(),
): AdminSiteLocationView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    clientName: row.clientName,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    geofenceRadiusMeters: row.geofenceRadiusMeters,
    projectId: row.projectId,
    projectName: row.projectName,
    projectCode: row.projectCode,
    isActive: row.isActive,
    assignedEmployees: assignmentsBySiteId.get(row.id) ?? [],
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapAdminLocationCaptureSession(
  row: AdminLocationCaptureSessionRow | undefined,
): AdminLocationCaptureSession | null {
  if (!row || !isAdminLocationCaptureSessionStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    adminUserId: row.adminUserId,
    status: row.status,
    tokenHash: row.tokenHash,
    expiresAt: toIsoString(row.expiresAt),
    capturedAt: row.capturedAt ? toIsoString(row.capturedAt) : null,
    capturedLatitude: row.capturedLatitude,
    capturedLongitude: row.capturedLongitude,
    capturedAccuracyMeters: row.capturedAccuracyMeters,
    capturedAddress: row.capturedAddress,
    capturedCity: row.capturedCity,
    capturedState: row.capturedState,
    capturedCountry: row.capturedCountry,
    failureReason: row.failureReason,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapAttendanceSettings(
  row: AttendanceSettingsRow | undefined,
): AdminAttendanceSettingsView | null {
  if (!row) {
    return null;
  }

  return {
    companyId: row.companyId,
    defaultShiftStart: row.defaultShiftStart.slice(0, 5),
    defaultShiftEnd: row.defaultShiftEnd.slice(0, 5),
    graceTimeMinutes: row.graceTimeMinutes,
    halfDayThresholdMinutes: row.halfDayThresholdMinutes,
    fullDayThresholdMinutes: row.fullDayThresholdMinutes,
    overtimeThresholdMinutes: row.overtimeThresholdMinutes,
    weeklyOffDays: (row.weeklyOffDays ?? []).filter(isAdminWeekdayKey),
    geofenceRequired: row.geofenceRequired,
    allowBrowserGpsFallback: row.allowBrowserGpsFallback,
    remoteAttendanceAllowed: row.remoteAttendanceAllowed,
    fieldVisitAttendanceAllowed: row.fieldVisitAttendanceAllowed,
    breakTrackingAllowed: row.breakTrackingAllowed,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapBiometricDevice(
  row: BiometricDeviceRow | undefined,
): AdminBiometricDeviceView | null {
  if (
    !row ||
    !isBiometricDeviceStatus(row.status) ||
    !isBiometricDeviceType(row.deviceType) ||
    !isBiometricConnectionType(row.connectionType) ||
    !isBiometricSyncStatus(row.lastSyncStatus)
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    officeLocationId: row.officeLocationId,
    officeLocationName: row.officeLocationName,
    deviceType: row.deviceType,
    ipAddress: row.ipAddress,
    port: row.port,
    serialNumber: row.serialNumber,
    connectionType: row.connectionType,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lastSyncAt: row.lastSyncAt ? toIsoString(row.lastSyncAt) : null,
    lastSyncStatus: row.lastSyncStatus,
    isActive: row.isActive,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapPayrollSettings(
  row: PayrollSettingsRow | undefined,
): AdminPayrollSettingsView | null {
  if (!row || !isPayrollCycleType(row.salaryCycle)) {
    return null;
  }

  return {
    companyId: row.companyId,
    salaryComponents: row.salaryComponents ?? [],
    earningsComponents: row.earningsComponents ?? [],
    deductionComponents: row.deductionComponents ?? [],
    pfEnabled: row.pfEnabled,
    esiEnabled: row.esiEnabled,
    ptEnabled: row.ptEnabled,
    salaryCycle: row.salaryCycle,
    payrollLockDay: row.payrollLockDay,
    payslipPublishDay: row.payslipPublishDay,
    overtimeRateRule: row.overtimeRateRule,
    unpaidLeaveDeductionRule: row.unpaidLeaveDeductionRule,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapNotificationSettings(
  row: NotificationSettingsRow | undefined,
): AdminNotificationSettingsView | null {
  if (!row) {
    return null;
  }

  return {
    companyId: row.companyId,
    emailNotifications: row.emailNotifications,
    smsNotifications: row.smsNotifications,
    inAppNotifications: row.inAppNotifications,
    attendanceAlerts: row.attendanceAlerts,
    leaveApprovalAlerts: row.leaveApprovalAlerts,
    payrollAlerts: row.payrollAlerts,
    announcementAlerts: row.announcementAlerts,
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function selectCompanyProfile(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const result = await executor.query<CompanyProfileRow>(
    `
      SELECT
        companies.id AS "companyId",
        companies.name AS "companyName",
        companies.code,
        companies.status,
        companies.onboarding_status AS "onboardingStatus",
        companies.legal_name AS "legalName",
        companies.cin,
        companies.gstin,
        companies.pan,
        companies.industry,
        companies.company_size AS "companySize",
        companies.website,
        companies.contact_email AS "email",
        companies.phone,
        companies.address_line_1 AS "addressLine1",
        companies.address_line_2 AS "addressLine2",
        companies.city,
        companies.state,
        companies.country,
        companies.postal_code AS "postalCode",
        companies.logo_url AS "logoUrl",
        companies.updated_at AS "updatedAt"
      FROM companies
      WHERE companies.id = $1
      LIMIT 1
    `,
    [companyId],
  );

  return mapCompanyProfile(result.rows[0]);
}

async function selectOfficeLocation(
  executor: DatabaseExecutor,
  companyId: string,
  officeLocationId: string,
) {
  const result = await executor.query<OfficeLocationRow>(
    `
      SELECT
        id,
        name,
        address,
        city,
        state,
        country,
        latitude,
        longitude,
        geofence_radius_meters AS "geofenceRadiusMeters",
        is_primary AS "isPrimary",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM office_locations
      WHERE company_id = $1
        AND id = $2
      LIMIT 1
    `,
    [companyId, officeLocationId],
  );

  return mapOfficeLocation(result.rows[0]);
}

async function listSiteLocationAssignments(
  executor: DatabaseExecutor,
  companyId: string,
  siteLocationIds: string[],
) {
  if (siteLocationIds.length === 0) {
    return new Map<string, AdminSiteLocationEmployeeOption[]>();
  }

  const result = await executor.query<SiteLocationAssignmentRow>(
    `
      SELECT
        employee_site_assignments.site_location_id AS "siteLocationId",
        users.id,
        users.full_name AS "fullName",
        users.email
      FROM employee_site_assignments
      INNER JOIN users
        ON users.id = employee_site_assignments.employee_id
      WHERE employee_site_assignments.company_id = $1
        AND employee_site_assignments.site_location_id = ANY($2::text[])
        AND employee_site_assignments.is_active = TRUE
        AND users.company_id = $1
        AND users.is_active = TRUE
      ORDER BY users.full_name ASC, users.email ASC
    `,
    [companyId, siteLocationIds],
  );

  const assignmentsBySiteId = new Map<string, AdminSiteLocationEmployeeOption[]>();

  for (const row of result.rows) {
    const existing = assignmentsBySiteId.get(row.siteLocationId) ?? [];
    existing.push(mapSiteLocationEmployeeOption(row));
    assignmentsBySiteId.set(row.siteLocationId, existing);
  }

  return assignmentsBySiteId;
}

async function selectSiteLocation(
  executor: DatabaseExecutor,
  companyId: string,
  siteLocationId: string,
) {
  const result = await executor.query<SiteLocationRow>(
    `
      SELECT
        site_locations.id,
        site_locations.name,
        site_locations.client_name AS "clientName",
        site_locations.address,
        site_locations.city,
        site_locations.state,
        site_locations.country,
        site_locations.latitude,
        site_locations.longitude,
        site_locations.geofence_radius_meters AS "geofenceRadiusMeters",
        site_locations.project_id AS "projectId",
        projects.name AS "projectName",
        projects.project_code AS "projectCode",
        site_locations.is_active AS "isActive",
        site_locations.created_at AS "createdAt",
        site_locations.updated_at AS "updatedAt"
      FROM site_locations
      LEFT JOIN projects
        ON projects.id = site_locations.project_id
       AND projects.company_id = site_locations.company_id
      WHERE site_locations.company_id = $1
        AND site_locations.id = $2
      LIMIT 1
    `,
    [companyId, siteLocationId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const assignments = await listSiteLocationAssignments(executor, companyId, [row.id]);
  return mapSiteLocation(row, assignments);
}

async function replaceSiteLocationAssignments(
  executor: DatabaseExecutor,
  input: {
    companyId: string;
    siteLocationId: string;
    assignedEmployeeIds: string[];
    assignedBy: string | null;
  },
) {
  await executor.query(
    `
      UPDATE employee_site_assignments
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE company_id = $1
        AND site_location_id = $2
    `,
    [input.companyId, input.siteLocationId],
  );

  if (input.assignedEmployeeIds.length === 0) {
    return;
  }

  for (const employeeId of input.assignedEmployeeIds) {
    await executor.query(
      `
        INSERT INTO employee_site_assignments (
          id,
          company_id,
          site_location_id,
          employee_id,
          assigned_by,
          effective_from,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          $1,
          $2,
          $3,
          users.id,
          $5,
          CURRENT_DATE,
          TRUE,
          NOW(),
          NOW()
        FROM users
        WHERE users.company_id = $2
          AND users.id = $4
          AND users.role = 'employee'
          AND users.is_active = TRUE
        ON CONFLICT (company_id, site_location_id, employee_id, effective_from)
        DO UPDATE SET
          assigned_by = EXCLUDED.assigned_by,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [randomUUID(), input.companyId, input.siteLocationId, employeeId, input.assignedBy],
    );
  }
}

async function selectAdminLocationCaptureSessionById(
  executor: DatabaseExecutor,
  sessionId: string,
  options?: {
    companyId?: string;
    adminUserId?: string;
    forUpdate?: boolean;
  },
) {
  const values: Array<string> = [sessionId];
  const conditions = [`id = $1`];

  if (options?.companyId) {
    values.push(options.companyId);
    conditions.push(`company_id = $${values.length}`);
  }

  if (options?.adminUserId) {
    values.push(options.adminUserId);
    conditions.push(`admin_user_id = $${values.length}`);
  }

  const result = await executor.query<AdminLocationCaptureSessionRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        admin_user_id AS "adminUserId",
        status,
        token_hash AS "tokenHash",
        expires_at AS "expiresAt",
        captured_at AS "capturedAt",
        captured_latitude AS "capturedLatitude",
        captured_longitude AS "capturedLongitude",
        captured_accuracy_meters AS "capturedAccuracyMeters",
        captured_address AS "capturedAddress",
        captured_city AS "capturedCity",
        captured_state AS "capturedState",
        captured_country AS "capturedCountry",
        failure_reason AS "failureReason",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM admin_location_capture_sessions
      WHERE ${conditions.join(" AND ")}
      ${options?.forUpdate ? "FOR UPDATE" : ""}
      LIMIT 1
    `,
    values,
  );

  return mapAdminLocationCaptureSession(result.rows[0]);
}

async function normalizePrimaryOffice(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const existingPrimary = await executor.query<{ id: string }>(
    `
      SELECT id
      FROM office_locations
      WHERE company_id = $1
        AND is_active = TRUE
        AND is_primary = TRUE
      LIMIT 1
    `,
    [companyId],
  );

  if (existingPrimary.rows[0]?.id) {
    return;
  }

  const fallbackOffice = await executor.query<{ id: string }>(
    `
      SELECT id
      FROM office_locations
      WHERE company_id = $1
        AND is_active = TRUE
      ORDER BY created_at ASC, name ASC
      LIMIT 1
    `,
    [companyId],
  );

  if (!fallbackOffice.rows[0]?.id) {
    return;
  }

  await executor.query(
    `
      UPDATE office_locations
      SET
        is_primary = TRUE,
        updated_at = NOW()
      WHERE id = $1
    `,
    [fallbackOffice.rows[0].id],
  );
}

async function ensureAttendanceSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  await executor.query(
    `
      INSERT INTO company_attendance_settings (
        company_id,
        created_at,
        updated_at
      )
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (company_id) DO NOTHING
    `,
    [companyId],
  );
}

async function ensurePayrollSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  await executor.query(
    `
      INSERT INTO company_payroll_settings (
        company_id,
        created_at,
        updated_at
      )
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (company_id) DO NOTHING
    `,
    [companyId],
  );
}

async function ensureNotificationSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  await executor.query(
    `
      INSERT INTO company_notification_settings (
        company_id,
        created_at,
        updated_at
      )
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (company_id) DO NOTHING
    `,
    [companyId],
  );
}

async function selectAttendanceSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const result = await executor.query<AttendanceSettingsRow>(
    `
      SELECT
        company_id AS "companyId",
        default_shift_start::text AS "defaultShiftStart",
        default_shift_end::text AS "defaultShiftEnd",
        grace_time_minutes AS "graceTimeMinutes",
        half_day_threshold_minutes AS "halfDayThresholdMinutes",
        full_day_threshold_minutes AS "fullDayThresholdMinutes",
        overtime_threshold_minutes AS "overtimeThresholdMinutes",
        weekly_off_days AS "weeklyOffDays",
        geofence_required AS "geofenceRequired",
        allow_browser_gps_fallback AS "allowBrowserGpsFallback",
        remote_attendance_allowed AS "remoteAttendanceAllowed",
        field_visit_attendance_allowed AS "fieldVisitAttendanceAllowed",
        break_tracking_allowed AS "breakTrackingAllowed",
        updated_at AS "updatedAt"
      FROM company_attendance_settings
      WHERE company_id = $1
      LIMIT 1
    `,
    [companyId],
  );

  return mapAttendanceSettings(result.rows[0]);
}

async function selectPayrollSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const result = await executor.query<PayrollSettingsRow>(
    `
      SELECT
        company_id AS "companyId",
        salary_components AS "salaryComponents",
        earnings_components AS "earningsComponents",
        deduction_components AS "deductionComponents",
        pf_enabled AS "pfEnabled",
        esi_enabled AS "esiEnabled",
        pt_enabled AS "ptEnabled",
        salary_cycle AS "salaryCycle",
        payroll_lock_day AS "payrollLockDay",
        payslip_publish_day AS "payslipPublishDay",
        overtime_rate_rule AS "overtimeRateRule",
        unpaid_leave_deduction_rule AS "unpaidLeaveDeductionRule",
        updated_at AS "updatedAt"
      FROM company_payroll_settings
      WHERE company_id = $1
      LIMIT 1
    `,
    [companyId],
  );

  return mapPayrollSettings(result.rows[0]);
}

async function selectNotificationSettings(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const result = await executor.query<NotificationSettingsRow>(
    `
      SELECT
        company_id AS "companyId",
        email_notifications AS "emailNotifications",
        sms_notifications AS "smsNotifications",
        in_app_notifications AS "inAppNotifications",
        attendance_alerts AS "attendanceAlerts",
        leave_approval_alerts AS "leaveApprovalAlerts",
        payroll_alerts AS "payrollAlerts",
        announcement_alerts AS "announcementAlerts",
        updated_at AS "updatedAt"
      FROM company_notification_settings
      WHERE company_id = $1
      LIMIT 1
    `,
    [companyId],
  );

  return mapNotificationSettings(result.rows[0]);
}

async function selectBiometricDevice(
  executor: DatabaseExecutor,
  companyId: string,
  deviceId: string,
) {
  const result = await executor.query<BiometricDeviceRow>(
    `
      SELECT
        biometric_devices.id,
        biometric_devices.name,
        biometric_devices.status,
        biometric_devices.office_location_id AS "officeLocationId",
        office_locations.name AS "officeLocationName",
        biometric_devices.device_type AS "deviceType",
        biometric_devices.ip_address AS "ipAddress",
        biometric_devices.port,
        biometric_devices.serial_number AS "serialNumber",
        biometric_devices.connection_type AS "connectionType",
        biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
        biometric_devices.last_sync_at AS "lastSyncAt",
        biometric_devices.last_sync_status AS "lastSyncStatus",
        biometric_devices.is_active AS "isActive",
        biometric_devices.updated_at AS "updatedAt"
      FROM biometric_devices
      LEFT JOIN office_locations
        ON office_locations.id = biometric_devices.office_location_id
      WHERE biometric_devices.company_id = $1
        AND biometric_devices.id = $2
      LIMIT 1
    `,
    [companyId, deviceId],
  );

  return mapBiometricDevice(result.rows[0]);
}

export const adminSettingsRepository = {
  findCompanyProfile(companyId: string) {
    return selectCompanyProfile(defaultExecutor, companyId);
  },

  async updateCompanyProfile(
    companyId: string,
    input: Omit<AdminCompanyProfileSettings, "companyId" | "code" | "status" | "onboardingStatus" | "updatedAt">,
  ) {
    const result = await query<CompanyProfileRow>(
      `
        UPDATE companies
        SET
          name = $2,
          legal_name = $3,
          cin = $4,
          gstin = $5,
          pan = $6,
          industry = $7,
          company_size = $8,
          website = $9,
          contact_email = $10,
          phone = $11,
          address_line_1 = $12,
          address_line_2 = $13,
          city = $14,
          state = $15,
          country = $16,
          postal_code = $17,
          logo_url = $18,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id AS "companyId",
          name AS "companyName",
          code,
          status,
          onboarding_status AS "onboardingStatus",
          legal_name AS "legalName",
          cin,
          gstin,
          pan,
          industry,
          company_size AS "companySize",
          website,
          contact_email AS "email",
          phone,
          address_line_1 AS "addressLine1",
          address_line_2 AS "addressLine2",
          city,
          state,
          country,
          postal_code AS "postalCode",
          logo_url AS "logoUrl",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        input.companyName,
        input.legalName,
        input.cin,
        input.gstin,
        input.pan,
        input.industry,
        input.companySize,
        input.website,
        input.email,
        input.phone,
        input.addressLine1,
        input.addressLine2,
        input.city,
        input.state,
        input.country,
        input.postalCode,
        input.logoUrl,
      ],
    );

    return mapCompanyProfile(result.rows[0]);
  },

  async listOfficeLocations(companyId: string) {
    const result = await query<OfficeLocationRow>(
      `
        SELECT
          id,
          name,
          address,
          city,
          state,
          country,
          latitude,
          longitude,
          geofence_radius_meters AS "geofenceRadiusMeters",
          is_primary AS "isPrimary",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM office_locations
        WHERE company_id = $1
        ORDER BY is_active DESC, is_primary DESC, name ASC, created_at ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapOfficeLocation(row))
      .filter((row): row is AdminOfficeLocationView => row !== null);
  },

  findOfficeLocation(companyId: string, officeLocationId: string) {
    return selectOfficeLocation(defaultExecutor, companyId, officeLocationId);
  },

  async listSiteLocations(companyId: string): Promise<AdminSiteLocationListResponse> {
    const [siteResult, projectResult, employeeResult] = await Promise.all([
      query<SiteLocationRow>(
        `
          SELECT
            site_locations.id,
            site_locations.name,
            site_locations.client_name AS "clientName",
            site_locations.address,
            site_locations.city,
            site_locations.state,
            site_locations.country,
            site_locations.latitude,
            site_locations.longitude,
            site_locations.geofence_radius_meters AS "geofenceRadiusMeters",
            site_locations.project_id AS "projectId",
            projects.name AS "projectName",
            projects.project_code AS "projectCode",
            site_locations.is_active AS "isActive",
            site_locations.created_at AS "createdAt",
            site_locations.updated_at AS "updatedAt"
          FROM site_locations
          LEFT JOIN projects
            ON projects.id = site_locations.project_id
           AND projects.company_id = site_locations.company_id
          WHERE site_locations.company_id = $1
          ORDER BY site_locations.is_active DESC, site_locations.name ASC, site_locations.created_at ASC
        `,
        [companyId],
      ),
      query<SiteLocationProjectOptionRow>(
        `
          SELECT
            id,
            name,
            project_code AS "code",
            client_name AS "clientName"
          FROM projects
          WHERE company_id = $1
            AND archived_at IS NULL
          ORDER BY name ASC, project_code ASC
        `,
        [companyId],
      ),
      query<SiteLocationEmployeeOptionRow>(
        `
          SELECT
            id,
            full_name AS "fullName",
            email
          FROM users
          WHERE company_id = $1
            AND role = 'employee'
            AND is_active = TRUE
          ORDER BY full_name ASC, email ASC
        `,
        [companyId],
      ),
    ]);
    const assignments = await listSiteLocationAssignments(
      defaultExecutor,
      companyId,
      siteResult.rows.map((row) => row.id),
    );

    return {
      items: siteResult.rows
        .map((row) => mapSiteLocation(row, assignments))
        .filter((row): row is AdminSiteLocationView => row !== null),
      projectOptions: projectResult.rows.map((row) => mapSiteLocationProjectOption(row)),
      employeeOptions: employeeResult.rows.map((row) => mapSiteLocationEmployeeOption(row)),
    };
  },

  findSiteLocation(companyId: string, siteLocationId: string) {
    return selectSiteLocation(defaultExecutor, companyId, siteLocationId);
  },

  async projectBelongsToCompany(companyId: string, projectId: string) {
    const result = await query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM projects
          WHERE company_id = $1
            AND id = $2
            AND archived_at IS NULL
        ) AS "exists"
      `,
      [companyId, projectId],
    );

    return result.rows[0]?.exists ?? false;
  },

  async countActiveEmployeesByIds(companyId: string, employeeIds: string[]) {
    if (employeeIds.length === 0) {
      return 0;
    }

    const result = await query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE company_id = $1
          AND id = ANY($2::text[])
          AND role = 'employee'
          AND is_active = TRUE
      `,
      [companyId, employeeIds],
    );

    return result.rows[0]?.count ?? 0;
  },

  async createSiteLocation(
    companyId: string,
    createdBy: string | null,
    input: SiteLocationMutationInput,
  ) {
    return withTransaction(async (client) => {
      const siteLocationId = randomUUID();

      await client.query(
        `
          INSERT INTO site_locations (
            id,
            company_id,
            project_id,
            name,
            client_name,
            address,
            city,
            state,
            country,
            latitude,
            longitude,
            geofence_radius_meters,
            is_active,
            created_by,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            COALESCE($9::text, 'India'),
            $10,
            $11,
            $12,
            $13,
            $14,
            NOW(),
            NOW()
          )
        `,
        [
          siteLocationId,
          companyId,
          input.projectId,
          input.name,
          input.clientName,
          input.address,
          input.city,
          input.state,
          input.country,
          input.latitude,
          input.longitude,
          input.geofenceRadiusMeters,
          input.isActive,
          createdBy,
        ],
      );

      await replaceSiteLocationAssignments(client, {
        companyId,
        siteLocationId,
        assignedEmployeeIds: input.assignedEmployeeIds,
        assignedBy: createdBy,
      });

      return selectSiteLocation(client, companyId, siteLocationId);
    });
  },

  async updateSiteLocation(
    companyId: string,
    siteLocationId: string,
    assignedBy: string | null,
    input: SiteLocationMutationInput,
  ) {
    return withTransaction(async (client) => {
      const existing = await selectSiteLocation(client, companyId, siteLocationId);

      if (!existing) {
        return null;
      }

      await client.query(
        `
          UPDATE site_locations
          SET
            project_id = $3,
            name = $4,
            client_name = $5,
            address = $6,
            city = $7,
            state = $8,
            country = COALESCE($9::text, 'India'),
            latitude = $10,
            longitude = $11,
            geofence_radius_meters = $12,
            is_active = $13,
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
        `,
        [
          companyId,
          siteLocationId,
          input.projectId,
          input.name,
          input.clientName,
          input.address,
          input.city,
          input.state,
          input.country,
          input.latitude,
          input.longitude,
          input.geofenceRadiusMeters,
          input.isActive,
        ],
      );

      await replaceSiteLocationAssignments(client, {
        companyId,
        siteLocationId,
        assignedEmployeeIds: input.assignedEmployeeIds,
        assignedBy,
      });

      return selectSiteLocation(client, companyId, siteLocationId);
    });
  },

  async deactivateSiteLocation(companyId: string, siteLocationId: string) {
    return withTransaction(async (client) => {
      const existing = await selectSiteLocation(client, companyId, siteLocationId);

      if (!existing) {
        return null;
      }

      await client.query(
        `
          UPDATE site_locations
          SET
            is_active = FALSE,
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
        `,
        [companyId, siteLocationId],
      );

      await client.query(
        `
          UPDATE employee_site_assignments
          SET
            is_active = FALSE,
            updated_at = NOW()
          WHERE company_id = $1
            AND site_location_id = $2
        `,
        [companyId, siteLocationId],
      );

      return {
        ...existing,
        isActive: false,
        assignedEmployees: [],
      };
    });
  },

  async createAdminLocationCaptureSession(input: {
    companyId: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: string;
  }) {
    const result = await query<AdminLocationCaptureSessionRow>(
      `
        INSERT INTO admin_location_capture_sessions (
          id,
          company_id,
          admin_user_id,
          status,
          token_hash,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'pending',
          $4,
          $5::timestamptz,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          company_id AS "companyId",
          admin_user_id AS "adminUserId",
          status,
          token_hash AS "tokenHash",
          expires_at AS "expiresAt",
          captured_at AS "capturedAt",
          captured_latitude AS "capturedLatitude",
          captured_longitude AS "capturedLongitude",
          captured_accuracy_meters AS "capturedAccuracyMeters",
          captured_address AS "capturedAddress",
          captured_city AS "capturedCity",
          captured_state AS "capturedState",
          captured_country AS "capturedCountry",
          failure_reason AS "failureReason",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [randomUUID(), input.companyId, input.adminUserId, input.tokenHash, input.expiresAt],
    );

    return mapAdminLocationCaptureSession(result.rows[0]);
  },

  findAdminLocationCaptureSessionById(
    sessionId: string,
    options?: {
      companyId?: string;
      adminUserId?: string;
    },
    executor?: DatabaseExecutor,
  ) {
    return selectAdminLocationCaptureSessionById(resolveExecutor(executor), sessionId, options);
  },

  lockAdminLocationCaptureSessionById(
    sessionId: string,
    options: {
      companyId?: string;
      adminUserId?: string;
    },
    executor: DatabaseExecutor,
  ) {
    return selectAdminLocationCaptureSessionById(executor, sessionId, {
      ...options,
      forUpdate: true,
    });
  },

  async updateAdminLocationCaptureSession(
    input: {
      sessionId: string;
      companyId: string;
      adminUserId?: string;
      status?: AdminLocationCaptureSessionStatus;
      capturedAt?: string | null;
      capturedLatitude?: number | null;
      capturedLongitude?: number | null;
      capturedAccuracyMeters?: number | null;
      capturedAddress?: string | null;
      capturedCity?: string | null;
      capturedState?: string | null;
      capturedCountry?: string | null;
      failureReason?: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AdminLocationCaptureSessionRow>(
      `
        UPDATE admin_location_capture_sessions
        SET
          status = COALESCE($4::text, status),
          captured_at = COALESCE($5::timestamptz, captured_at),
          captured_latitude = COALESCE($6::double precision, captured_latitude),
          captured_longitude = COALESCE($7::double precision, captured_longitude),
          captured_accuracy_meters = COALESCE($8::double precision, captured_accuracy_meters),
          captured_address = COALESCE($9::text, captured_address),
          captured_city = COALESCE($10::text, captured_city),
          captured_state = COALESCE($11::text, captured_state),
          captured_country = COALESCE($12::text, captured_country),
          failure_reason = CASE
            WHEN $13::text IS NULL THEN failure_reason
            ELSE $13::text
          END,
          updated_at = NOW()
        WHERE id = $1
          AND company_id = $2
          AND ($3::text IS NULL OR admin_user_id = $3)
        RETURNING
          id,
          company_id AS "companyId",
          admin_user_id AS "adminUserId",
          status,
          token_hash AS "tokenHash",
          expires_at AS "expiresAt",
          captured_at AS "capturedAt",
          captured_latitude AS "capturedLatitude",
          captured_longitude AS "capturedLongitude",
          captured_accuracy_meters AS "capturedAccuracyMeters",
          captured_address AS "capturedAddress",
          captured_city AS "capturedCity",
          captured_state AS "capturedState",
          captured_country AS "capturedCountry",
          failure_reason AS "failureReason",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        input.sessionId,
        input.companyId,
        input.adminUserId ?? null,
        input.status ?? null,
        input.capturedAt ?? null,
        input.capturedLatitude ?? null,
        input.capturedLongitude ?? null,
        input.capturedAccuracyMeters ?? null,
        input.capturedAddress ?? null,
        input.capturedCity ?? null,
        input.capturedState ?? null,
        input.capturedCountry ?? null,
        input.failureReason ?? null,
      ],
    );

    return mapAdminLocationCaptureSession(result.rows[0]);
  },

  async createOfficeLocation(
    companyId: string,
    input: Omit<AdminOfficeLocationView, "id" | "createdAt" | "updatedAt">,
  ) {
    return withTransaction(async (client) => {
      const existingOfficeCount = await client.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM office_locations
          WHERE company_id = $1
            AND is_active = TRUE
        `,
        [companyId],
      );

      const shouldBePrimary =
        input.isActive && (input.isPrimary || Number(existingOfficeCount.rows[0]?.count ?? 0) === 0);

      if (shouldBePrimary) {
        await client.query(
          `
            UPDATE office_locations
            SET
              is_primary = FALSE,
              updated_at = NOW()
            WHERE company_id = $1
          `,
          [companyId],
        );
      }

      const officeLocationId = randomUUID();

      await client.query(
        `
          INSERT INTO office_locations (
            id,
            company_id,
            name,
            address,
            city,
            state,
            country,
            latitude,
            longitude,
            geofence_radius_meters,
            is_primary,
            is_active,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            NOW(),
            NOW()
          )
        `,
        [
          officeLocationId,
          companyId,
          input.name,
          input.address,
          input.city,
          input.state,
          input.country,
          input.latitude,
          input.longitude,
          input.geofenceRadiusMeters,
          shouldBePrimary,
          input.isActive,
        ],
      );

      await normalizePrimaryOffice(client, companyId);

      return selectOfficeLocation(client, companyId, officeLocationId);
    });
  },

  async updateOfficeLocation(
    companyId: string,
    officeLocationId: string,
    input: Omit<AdminOfficeLocationView, "id" | "createdAt" | "updatedAt">,
  ) {
    return withTransaction(async (client) => {
      const existing = await selectOfficeLocation(client, companyId, officeLocationId);

      if (!existing) {
        return null;
      }

      const shouldBePrimary = input.isActive && input.isPrimary;

      if (shouldBePrimary) {
        await client.query(
          `
            UPDATE office_locations
            SET
              is_primary = FALSE,
              updated_at = NOW()
            WHERE company_id = $1
              AND id <> $2
          `,
          [companyId, officeLocationId],
        );
      }

      await client.query(
        `
          UPDATE office_locations
          SET
            name = $3,
            address = $4,
            city = $5,
            state = $6,
            country = $7,
            latitude = $8,
            longitude = $9,
            geofence_radius_meters = $10,
            is_primary = $11,
            is_active = $12,
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
        `,
        [
          companyId,
          officeLocationId,
          input.name,
          input.address,
          input.city,
          input.state,
          input.country,
          input.latitude,
          input.longitude,
          input.geofenceRadiusMeters,
          shouldBePrimary,
          input.isActive,
        ],
      );

      await normalizePrimaryOffice(client, companyId);

      return selectOfficeLocation(client, companyId, officeLocationId);
    });
  },

  async deactivateOfficeLocation(companyId: string, officeLocationId: string) {
    return withTransaction(async (client) => {
      const existing = await selectOfficeLocation(client, companyId, officeLocationId);

      if (!existing) {
        return null;
      }

      await client.query(
        `
          DELETE FROM office_locations
          WHERE company_id = $1
            AND id = $2
        `,
        [companyId, officeLocationId],
      );

      await normalizePrimaryOffice(client, companyId);

      return existing;
    });
  },

  async getAttendanceSettings(companyId: string) {
    await ensureAttendanceSettings(defaultExecutor, companyId);
    return selectAttendanceSettings(defaultExecutor, companyId);
  },

  async updateAttendanceSettings(
    companyId: string,
    input: Omit<AdminAttendanceSettingsView, "companyId" | "updatedAt">,
  ) {
    await ensureAttendanceSettings(defaultExecutor, companyId);

    const result = await query<AttendanceSettingsRow>(
      `
        UPDATE company_attendance_settings
        SET
          default_shift_start = $2::time,
          default_shift_end = $3::time,
          grace_time_minutes = $4,
          half_day_threshold_minutes = $5,
          full_day_threshold_minutes = $6,
          overtime_threshold_minutes = $7,
          weekly_off_days = $8::text[],
          geofence_required = $9,
          allow_browser_gps_fallback = $10,
          remote_attendance_allowed = $11,
          field_visit_attendance_allowed = $12,
          break_tracking_allowed = $13,
          updated_at = NOW()
        WHERE company_id = $1
        RETURNING
          company_id AS "companyId",
          default_shift_start::text AS "defaultShiftStart",
          default_shift_end::text AS "defaultShiftEnd",
          grace_time_minutes AS "graceTimeMinutes",
          half_day_threshold_minutes AS "halfDayThresholdMinutes",
          full_day_threshold_minutes AS "fullDayThresholdMinutes",
          overtime_threshold_minutes AS "overtimeThresholdMinutes",
          weekly_off_days AS "weeklyOffDays",
          geofence_required AS "geofenceRequired",
          allow_browser_gps_fallback AS "allowBrowserGpsFallback",
          remote_attendance_allowed AS "remoteAttendanceAllowed",
          field_visit_attendance_allowed AS "fieldVisitAttendanceAllowed",
          break_tracking_allowed AS "breakTrackingAllowed",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        input.defaultShiftStart,
        input.defaultShiftEnd,
        input.graceTimeMinutes,
        input.halfDayThresholdMinutes,
        input.fullDayThresholdMinutes,
        input.overtimeThresholdMinutes,
        input.weeklyOffDays,
        input.geofenceRequired,
        input.allowBrowserGpsFallback,
        input.remoteAttendanceAllowed,
        input.fieldVisitAttendanceAllowed,
        input.breakTrackingAllowed,
      ],
    );

    return mapAttendanceSettings(result.rows[0]);
  },

  async listBiometricDevices(companyId: string) {
    const result = await query<BiometricDeviceRow>(
      `
        SELECT
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          office_locations.name AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.ip_address AS "ipAddress",
          biometric_devices.port,
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.connection_type AS "connectionType",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.last_sync_status AS "lastSyncStatus",
          biometric_devices.is_active AS "isActive",
          biometric_devices.updated_at AS "updatedAt"
        FROM biometric_devices
        LEFT JOIN office_locations
          ON office_locations.id = biometric_devices.office_location_id
        WHERE biometric_devices.company_id = $1
        ORDER BY biometric_devices.is_active DESC, biometric_devices.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapBiometricDevice(row))
      .filter((row): row is AdminBiometricDeviceView => row !== null);
  },

  findBiometricDevice(companyId: string, deviceId: string) {
    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async createBiometricDevice(
    companyId: string,
    input: Omit<
      AdminBiometricDeviceView,
      | "id"
      | "status"
      | "officeLocationName"
      | "lastSyncAt"
      | "lastSyncStatus"
      | "updatedAt"
    >,
  ) {
    const deviceId = randomUUID();

    await query(
      `
        INSERT INTO biometric_devices (
          id,
          company_id,
          office_location_id,
          name,
          device_type,
          ip_address,
          port,
          serial_number,
          connection_type,
          sync_interval_minutes,
          status,
          last_sync_status,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          'pending',
          $12,
          NOW(),
          NOW()
        )
      `,
      [
        deviceId,
        companyId,
        input.officeLocationId,
        input.name,
        input.deviceType,
        input.ipAddress,
        input.port,
        input.serialNumber,
        input.connectionType,
        input.syncIntervalMinutes,
        input.isActive ? "offline" : "inactive",
        input.isActive,
      ],
    );

    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async updateBiometricDevice(
    companyId: string,
    deviceId: string,
    input: Omit<
      AdminBiometricDeviceView,
      | "id"
      | "status"
      | "officeLocationName"
      | "lastSyncAt"
      | "lastSyncStatus"
      | "updatedAt"
    >,
  ) {
    const result = await query<BiometricDeviceRow>(
      `
        UPDATE biometric_devices
        SET
          office_location_id = $3,
          name = $4,
          device_type = $5,
          ip_address = $6,
          port = $7,
          serial_number = $8,
          connection_type = $9,
          sync_interval_minutes = $10,
          status = $11,
          is_active = $12,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.ip_address AS "ipAddress",
          biometric_devices.port,
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.connection_type AS "connectionType",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.last_sync_status AS "lastSyncStatus",
          biometric_devices.is_active AS "isActive",
          biometric_devices.updated_at AS "updatedAt"
      `,
      [
        companyId,
        deviceId,
        input.officeLocationId,
        input.name,
        input.deviceType,
        input.ipAddress,
        input.port,
        input.serialNumber,
        input.connectionType,
        input.syncIntervalMinutes,
        input.isActive ? "offline" : "inactive",
        input.isActive,
      ],
    );

    if (!result.rows[0]) {
      return null;
    }

    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async syncBiometricDevice(companyId: string, deviceId: string) {
    const result = await query<BiometricDeviceRow>(
      `
        UPDATE biometric_devices
        SET
          status = 'online',
          last_sync_at = NOW(),
          last_sync_status = 'success',
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.ip_address AS "ipAddress",
          biometric_devices.port,
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.connection_type AS "connectionType",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.last_sync_status AS "lastSyncStatus",
          biometric_devices.is_active AS "isActive",
          biometric_devices.updated_at AS "updatedAt"
      `,
      [companyId, deviceId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async deactivateBiometricDevice(companyId: string, deviceId: string) {
    const result = await query<BiometricDeviceRow>(
      `
        UPDATE biometric_devices
        SET
          is_active = FALSE,
          status = 'inactive',
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.ip_address AS "ipAddress",
          biometric_devices.port,
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.connection_type AS "connectionType",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.last_sync_status AS "lastSyncStatus",
          biometric_devices.is_active AS "isActive",
          biometric_devices.updated_at AS "updatedAt"
      `,
      [companyId, deviceId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async listPendingBiometricLogs(
    companyId: string,
    deviceId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await (executor ?? defaultExecutor).query<BiometricPunchLogRow>(
      `
        SELECT
          id,
          user_id AS "userId",
          biometric_identifier AS "biometricIdentifier",
          punch_time AS "punchTime",
          punch_type AS "punchType",
          raw_payload AS "rawPayload"
        FROM biometric_punch_logs
        WHERE company_id = $1
          AND biometric_device_id = $2
          AND sync_status = 'pending'
        ORDER BY punch_time ASC, created_at ASC
      `,
      [companyId, deviceId],
    );

    return result.rows;
  },

  async resolveMappedUserId(
    companyId: string,
    deviceId: string,
    biometricIdentifier: string | null,
    executor?: DatabaseExecutor,
  ) {
    if (!biometricIdentifier) {
      return null;
    }

    const result = await (executor ?? defaultExecutor).query<{ userId: string }>(
      `
        SELECT user_id AS "userId"
        FROM employee_biometric_mappings
        WHERE company_id = $1
          AND biometric_device_id = $2
          AND is_active = TRUE
          AND (
            biometric_identifier = $3
            OR employee_code = $3
          )
        LIMIT 1
      `,
      [companyId, deviceId, biometricIdentifier],
    );

    return result.rows[0]?.userId ?? null;
  },

  async updateBiometricLogSyncStatus(
    companyId: string,
    logId: string,
    status: "processed" | "failed",
    executor?: DatabaseExecutor,
  ) {
    await (executor ?? defaultExecutor).query(
      `
        UPDATE biometric_punch_logs
        SET
          sync_status = $3,
          synced_at = CASE WHEN $3 = 'processed' THEN NOW() ELSE synced_at END,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
      `,
      [companyId, logId, status],
    );
  },

  async updateBiometricDeviceSyncState(
    companyId: string,
    deviceId: string,
    input: {
      status: BiometricDeviceStatus;
      lastSyncStatus: BiometricSyncStatus;
    },
  ) {
    const result = await query<BiometricDeviceRow>(
      `
        UPDATE biometric_devices
        SET
          status = $3,
          last_sync_at = NOW(),
          last_sync_status = $4,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.ip_address AS "ipAddress",
          biometric_devices.port,
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.connection_type AS "connectionType",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.last_sync_status AS "lastSyncStatus",
          biometric_devices.is_active AS "isActive",
          biometric_devices.updated_at AS "updatedAt"
      `,
      [companyId, deviceId, input.status, input.lastSyncStatus],
    );

    if (!result.rows[0]) {
      return null;
    }

    return selectBiometricDevice(defaultExecutor, companyId, deviceId);
  },

  async getPayrollSettings(companyId: string) {
    await ensurePayrollSettings(defaultExecutor, companyId);
    return selectPayrollSettings(defaultExecutor, companyId);
  },

  async updatePayrollSettings(
    companyId: string,
    input: Omit<AdminPayrollSettingsView, "companyId" | "updatedAt">,
  ) {
    await ensurePayrollSettings(defaultExecutor, companyId);

    const result = await query<PayrollSettingsRow>(
      `
        UPDATE company_payroll_settings
        SET
          salary_components = $2::text[],
          earnings_components = $3::text[],
          deduction_components = $4::text[],
          pf_enabled = $5,
          esi_enabled = $6,
          pt_enabled = $7,
          salary_cycle = $8,
          payroll_lock_day = $9,
          payslip_publish_day = $10,
          overtime_rate_rule = $11,
          unpaid_leave_deduction_rule = $12,
          updated_at = NOW()
        WHERE company_id = $1
        RETURNING
          company_id AS "companyId",
          salary_components AS "salaryComponents",
          earnings_components AS "earningsComponents",
          deduction_components AS "deductionComponents",
          pf_enabled AS "pfEnabled",
          esi_enabled AS "esiEnabled",
          pt_enabled AS "ptEnabled",
          salary_cycle AS "salaryCycle",
          payroll_lock_day AS "payrollLockDay",
          payslip_publish_day AS "payslipPublishDay",
          overtime_rate_rule AS "overtimeRateRule",
          unpaid_leave_deduction_rule AS "unpaidLeaveDeductionRule",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        input.salaryComponents,
        input.earningsComponents,
        input.deductionComponents,
        input.pfEnabled,
        input.esiEnabled,
        input.ptEnabled,
        input.salaryCycle,
        input.payrollLockDay,
        input.payslipPublishDay,
        input.overtimeRateRule,
        input.unpaidLeaveDeductionRule,
      ],
    );

    return mapPayrollSettings(result.rows[0]);
  },

  async getNotificationSettings(companyId: string) {
    await ensureNotificationSettings(defaultExecutor, companyId);
    return selectNotificationSettings(defaultExecutor, companyId);
  },

  async updateNotificationSettings(
    companyId: string,
    input: Omit<AdminNotificationSettingsView, "companyId" | "updatedAt">,
  ) {
    await ensureNotificationSettings(defaultExecutor, companyId);

    const result = await query<NotificationSettingsRow>(
      `
        UPDATE company_notification_settings
        SET
          email_notifications = $2,
          sms_notifications = $3,
          in_app_notifications = $4,
          attendance_alerts = $5,
          leave_approval_alerts = $6,
          payroll_alerts = $7,
          announcement_alerts = $8,
          updated_at = NOW()
        WHERE company_id = $1
        RETURNING
          company_id AS "companyId",
          email_notifications AS "emailNotifications",
          sms_notifications AS "smsNotifications",
          in_app_notifications AS "inAppNotifications",
          attendance_alerts AS "attendanceAlerts",
          leave_approval_alerts AS "leaveApprovalAlerts",
          payroll_alerts AS "payrollAlerts",
          announcement_alerts AS "announcementAlerts",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        input.emailNotifications,
        input.smsNotifications,
        input.inAppNotifications,
        input.attendanceAlerts,
        input.leaveApprovalAlerts,
        input.payrollAlerts,
        input.announcementAlerts,
      ],
    );

    return mapNotificationSettings(result.rows[0]);
  },

  async getSettingsSummary(companyId: string) {
    const result = await query<SettingsSummaryRow>(
      `
        SELECT
          (SELECT COUNT(*)::int
            FROM office_locations
            WHERE company_id = $1
              AND is_active = TRUE) AS "officeCount",
          (SELECT COUNT(*)::int
            FROM biometric_devices
            WHERE company_id = $1) AS "biometricDeviceCount",
          (SELECT COUNT(*)::int
            FROM roles
            WHERE company_id = $1) AS "roleCount",
          (SELECT COUNT(*)::int
            FROM documents
            WHERE company_id = $1) AS "documentCount"
      `,
      [companyId],
    );

    return result.rows[0] ?? {
      officeCount: 0,
      biometricDeviceCount: 0,
      roleCount: 0,
      documentCount: 0,
    };
  },
};
