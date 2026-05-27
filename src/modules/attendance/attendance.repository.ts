import { randomUUID } from "node:crypto";
import {
  query,
  type DatabaseExecutor,
  withTransaction,
} from "../../database/index.js";
import type {
  AttendanceLocationProof,
  AttendanceQrAction,
  AttendanceQrSession,
  AttendanceQrSessionStatus,
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceSource,
  AttendanceVerificationSource,
  EmployeeAttendanceBiometricDevice,
  EmployeeOfficeLocation,
  EmployeeSiteLocation,
} from "./attendance.types.js";

type AttendanceRecordRow = {
  id: string;
  userId: string;
  attendanceDate: string;
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
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
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CurrentDateRow = {
  currentDate: string;
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
};

type AttendanceSettingsRow = {
  defaultShiftStart: string;
  defaultShiftEnd: string;
  graceTimeMinutes: number;
  halfDayThresholdMinutes: number;
  fullDayThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  geofenceRequired: boolean;
  allowBrowserGpsFallback: boolean;
  remoteAttendanceAllowed: boolean;
  fieldVisitAttendanceAllowed: boolean;
  breakTrackingAllowed: boolean;
};

type BiometricDeviceRow = {
  id: string;
  name: string;
  status: "online" | "offline" | "inactive";
  officeLocationId: string | null;
  officeLocationName: string | null;
  deviceType: string;
  serialNumber: string | null;
  lastSyncAt: Date | string | null;
  syncIntervalMinutes: number;
};

type AttendanceQrSessionRow = {
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
  expiresAt: Date | string;
  verifiedAt: Date | string | null;
  verifiedLatitude: number | null;
  verifiedLongitude: number | null;
  verifiedAccuracyMeters: number | null;
  verifiedDistanceMeters: number | null;
  failureReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? { query };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapAttendanceRecord(
  row: AttendanceRecordRow | undefined,
): AttendanceRecord | null {
  if (!row) {
    return null;
  }

  const durationMinutes =
    row.checkInAt !== null && row.checkOutAt !== null
      ? Math.max(
          0,
          Math.round(
            (new Date(row.checkOutAt).getTime() - new Date(row.checkInAt).getTime()) /
              60000,
          ),
        )
      : null;

  return {
    id: row.id,
    userId: row.userId,
    attendanceDate: row.attendanceDate,
    checkInAt: row.checkInAt ? toIsoString(row.checkInAt) : null,
    checkOutAt: row.checkOutAt ? toIsoString(row.checkOutAt) : null,
    checkInLatitude: row.checkInLatitude,
    checkInLongitude: row.checkInLongitude,
    checkInAccuracyMeters: row.checkInAccuracyMeters,
    checkInDistanceMeters: row.checkInDistanceMeters,
    checkInVerificationSource: row.checkInVerificationSource,
    checkOutLatitude: row.checkOutLatitude,
    checkOutLongitude: row.checkOutLongitude,
    checkOutAccuracyMeters: row.checkOutAccuracyMeters,
    checkOutDistanceMeters: row.checkOutDistanceMeters,
    checkOutVerificationSource: row.checkOutVerificationSource,
    status: row.status,
    source: row.source,
    locationId: row.locationId,
    locationName: row.locationName,
    siteLocationId: row.siteLocationId,
    siteLocationName: row.siteLocationName,
    projectId: row.projectId,
    projectName: row.projectName,
    clientName: row.clientName,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    notes: row.notes,
    durationMinutes,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapAttendanceQrSession(
  row: AttendanceQrSessionRow | undefined,
): AttendanceQrSession | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    employeeId: row.employeeId,
    officeLocationId: row.officeLocationId,
    officeLocationName: row.officeLocationName,
    officeLocationRadiusMeters: row.officeLocationRadiusMeters,
    attendanceRecordId: row.attendanceRecordId,
    action: row.action,
    status: row.status,
    tokenHash: row.tokenHash,
    expiresAt: toIsoString(row.expiresAt),
    verifiedAt: row.verifiedAt ? toIsoString(row.verifiedAt) : null,
    verifiedLatitude: row.verifiedLatitude,
    verifiedLongitude: row.verifiedLongitude,
    verifiedAccuracyMeters: row.verifiedAccuracyMeters,
    verifiedDistanceMeters: row.verifiedDistanceMeters,
    failureReason: row.failureReason,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapOfficeLocation(
  row: OfficeLocationRow | undefined,
): EmployeeOfficeLocation | null {
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
  };
}

function mapSiteLocation(
  row: SiteLocationRow | undefined,
): EmployeeSiteLocation | null {
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
  };
}

function mapBiometricDevice(
  row: BiometricDeviceRow | undefined,
): EmployeeAttendanceBiometricDevice | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    officeLocationId: row.officeLocationId,
    officeLocationName: row.officeLocationName,
    deviceType: row.deviceType,
    serialNumber: row.serialNumber,
    lastSyncAt: row.lastSyncAt ? toIsoString(row.lastSyncAt) : null,
    syncIntervalMinutes: row.syncIntervalMinutes,
  };
}

const attendanceRecordSelect = `
  SELECT
    attendance_records.id,
    attendance_records.user_id AS "userId",
    attendance_records.attendance_date::text AS "attendanceDate",
    attendance_records.check_in_at AS "checkInAt",
    attendance_records.check_out_at AS "checkOutAt",
    attendance_records.check_in_latitude AS "checkInLatitude",
    attendance_records.check_in_longitude AS "checkInLongitude",
    attendance_records.check_in_accuracy_meters AS "checkInAccuracyMeters",
    attendance_records.check_in_distance_meters AS "checkInDistanceMeters",
    attendance_records.check_in_verification_source AS "checkInVerificationSource",
    attendance_records.check_out_latitude AS "checkOutLatitude",
    attendance_records.check_out_longitude AS "checkOutLongitude",
    attendance_records.check_out_accuracy_meters AS "checkOutAccuracyMeters",
    attendance_records.check_out_distance_meters AS "checkOutDistanceMeters",
    attendance_records.check_out_verification_source AS "checkOutVerificationSource",
    attendance_records.status,
    attendance_records.source,
    attendance_records.office_location_id AS "locationId",
    office_locations.name AS "locationName",
    attendance_records.site_location_id AS "siteLocationId",
    site_locations.name AS "siteLocationName",
    attendance_records.project_id AS "projectId",
    projects.name AS "projectName",
    COALESCE(site_locations.client_name, projects.client_name) AS "clientName",
    attendance_records.biometric_device_id AS "deviceId",
    biometric_devices.name AS "deviceName",
    attendance_records.notes,
    attendance_records.created_at AS "createdAt",
    attendance_records.updated_at AS "updatedAt"
  FROM attendance_records
  LEFT JOIN office_locations
    ON office_locations.id = attendance_records.office_location_id
  LEFT JOIN site_locations
    ON site_locations.id = attendance_records.site_location_id
   AND site_locations.company_id = attendance_records.company_id
  LEFT JOIN projects
    ON projects.id = attendance_records.project_id
   AND projects.company_id = attendance_records.company_id
  LEFT JOIN biometric_devices
    ON biometric_devices.id = attendance_records.biometric_device_id
`;

const attendanceQrSessionSelect = `
  SELECT
    attendance_qr_sessions.id,
    attendance_qr_sessions.company_id AS "companyId",
    attendance_qr_sessions.employee_id AS "employeeId",
    attendance_qr_sessions.office_location_id AS "officeLocationId",
    office_locations.name AS "officeLocationName",
    office_locations.geofence_radius_meters AS "officeLocationRadiusMeters",
    attendance_qr_sessions.attendance_record_id AS "attendanceRecordId",
    attendance_qr_sessions.action,
    attendance_qr_sessions.status,
    attendance_qr_sessions.token_hash AS "tokenHash",
    attendance_qr_sessions.expires_at AS "expiresAt",
    attendance_qr_sessions.verified_at AS "verifiedAt",
    attendance_qr_sessions.verified_latitude AS "verifiedLatitude",
    attendance_qr_sessions.verified_longitude AS "verifiedLongitude",
    attendance_qr_sessions.verified_accuracy_meters AS "verifiedAccuracyMeters",
    attendance_qr_sessions.verified_distance_meters AS "verifiedDistanceMeters",
    attendance_qr_sessions.failure_reason AS "failureReason",
    attendance_qr_sessions.created_at AS "createdAt",
    attendance_qr_sessions.updated_at AS "updatedAt"
  FROM attendance_qr_sessions
  LEFT JOIN office_locations
    ON office_locations.id = attendance_qr_sessions.office_location_id
`;

async function ensureAttendanceSettings(companyId: string, executor?: DatabaseExecutor) {
  await resolveExecutor(executor).query(
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

async function selectAttendanceRecordByDate(
  executor: DatabaseExecutor,
  companyId: string,
  userId: string,
  attendanceDate: string,
  forUpdate = false,
) {
  const result = await executor.query<AttendanceRecordRow>(
    `
      ${attendanceRecordSelect}
      WHERE attendance_records.company_id = $1
        AND attendance_records.user_id = $2
        AND attendance_records.attendance_date = $3::date
      LIMIT 1
      ${forUpdate ? "FOR UPDATE OF attendance_records" : ""}
    `,
    [companyId, userId, attendanceDate],
  );

  return mapAttendanceRecord(result.rows[0]);
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
        is_primary AS "isPrimary"
      FROM office_locations
      WHERE company_id = $1
        AND id = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [companyId, officeLocationId],
  );

  return mapOfficeLocation(result.rows[0]);
}

async function selectAssignedSiteLocation(
  executor: DatabaseExecutor,
  companyId: string,
  userId: string,
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
        projects.project_code AS "projectCode"
      FROM site_locations
      INNER JOIN employee_site_assignments
        ON employee_site_assignments.site_location_id = site_locations.id
       AND employee_site_assignments.company_id = site_locations.company_id
       AND employee_site_assignments.employee_id = $3
       AND employee_site_assignments.is_active = TRUE
       AND employee_site_assignments.effective_from <= CURRENT_DATE
       AND (
         employee_site_assignments.effective_to IS NULL
         OR employee_site_assignments.effective_to >= CURRENT_DATE
       )
      LEFT JOIN projects
        ON projects.id = site_locations.project_id
       AND projects.company_id = site_locations.company_id
      WHERE site_locations.company_id = $1
        AND site_locations.id = $2
        AND site_locations.is_active = TRUE
      LIMIT 1
    `,
    [companyId, siteLocationId, userId],
  );

  return mapSiteLocation(result.rows[0]);
}

async function selectPrimaryOfficeLocation(
  executor: DatabaseExecutor,
  companyId: string,
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
        is_primary AS "isPrimary"
      FROM office_locations
      WHERE company_id = $1
        AND is_active = TRUE
      ORDER BY is_primary DESC, created_at ASC, name ASC
      LIMIT 1
    `,
    [companyId],
  );

  return mapOfficeLocation(result.rows[0]);
}

async function selectAttendanceQrSessionById(
  executor: DatabaseExecutor,
  sessionId: string,
  options?: {
    companyId?: string;
    employeeId?: string;
    forUpdate?: boolean;
  },
) {
  const conditions = [
    `attendance_qr_sessions.id = $1`,
    options?.companyId ? `attendance_qr_sessions.company_id = $2` : null,
    options?.employeeId
      ? `attendance_qr_sessions.employee_id = $${options?.companyId ? 3 : 2}`
      : null,
  ].filter((condition): condition is string => Boolean(condition));

  const values: string[] = [sessionId];

  if (options?.companyId) {
    values.push(options.companyId);
  }

  if (options?.employeeId) {
    values.push(options.employeeId);
  }

  const result = await executor.query<AttendanceQrSessionRow>(
    `
      ${attendanceQrSessionSelect}
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
      ${options?.forUpdate ? "FOR UPDATE OF attendance_qr_sessions" : ""}
    `,
    values,
  );

  return mapAttendanceQrSession(result.rows[0]);
}

export const attendanceRepository = {
  async getCurrentDate() {
    const result = await query<CurrentDateRow>(
      `SELECT CURRENT_DATE::text AS "currentDate"`,
    );

    return result.rows[0]?.currentDate ?? "";
  },

  async listCompanyAttendanceRecords(companyId: string) {
    const result = await query<AttendanceRecordRow>(
      `
        ${attendanceRecordSelect}
        WHERE attendance_records.company_id = $1
        ORDER BY attendance_records.attendance_date DESC, attendance_records.updated_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapAttendanceRecord(row))
      .filter((row): row is AttendanceRecord => row !== null);
  },

  async listSelfAttendanceRecords(companyId: string, userId: string) {
    const result = await query<AttendanceRecordRow>(
      `
        ${attendanceRecordSelect}
        WHERE attendance_records.company_id = $1
          AND attendance_records.user_id = $2
        ORDER BY attendance_records.attendance_date DESC, attendance_records.updated_at DESC
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapAttendanceRecord(row))
      .filter((row): row is AttendanceRecord => row !== null);
  },

  async findAttendanceRecordByDate(
    companyId: string,
    userId: string,
    attendanceDate: string,
    executor?: DatabaseExecutor,
  ) {
    return selectAttendanceRecordByDate(
      resolveExecutor(executor),
      companyId,
      userId,
      attendanceDate,
    );
  },

  async lockAttendanceRecordByDate(
    companyId: string,
    userId: string,
    attendanceDate: string,
    executor: DatabaseExecutor,
  ) {
    return selectAttendanceRecordByDate(
      executor,
      companyId,
      userId,
      attendanceDate,
      true,
    );
  },

  async listCompanyOfficeLocations(companyId: string) {
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
          is_primary AS "isPrimary"
        FROM office_locations
        WHERE company_id = $1
          AND is_active = TRUE
        ORDER BY is_primary DESC, name ASC, created_at ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapOfficeLocation(row))
      .filter((row): row is EmployeeOfficeLocation => row !== null);
  },

  async listEmployeeSiteLocations(companyId: string, userId: string) {
    const result = await query<SiteLocationRow>(
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
          projects.project_code AS "projectCode"
        FROM site_locations
        INNER JOIN employee_site_assignments
          ON employee_site_assignments.site_location_id = site_locations.id
         AND employee_site_assignments.company_id = site_locations.company_id
         AND employee_site_assignments.employee_id = $2
         AND employee_site_assignments.is_active = TRUE
         AND employee_site_assignments.effective_from <= CURRENT_DATE
         AND (
           employee_site_assignments.effective_to IS NULL
           OR employee_site_assignments.effective_to >= CURRENT_DATE
         )
        LEFT JOIN projects
          ON projects.id = site_locations.project_id
         AND projects.company_id = site_locations.company_id
        WHERE site_locations.company_id = $1
          AND site_locations.is_active = TRUE
        ORDER BY site_locations.name ASC, site_locations.created_at ASC
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapSiteLocation(row))
      .filter((row): row is EmployeeSiteLocation => row !== null);
  },

  findOfficeLocationById(companyId: string, officeLocationId: string, executor?: DatabaseExecutor) {
    return selectOfficeLocation(resolveExecutor(executor), companyId, officeLocationId);
  },

  findAssignedSiteLocationById(
    companyId: string,
    userId: string,
    siteLocationId: string,
    executor?: DatabaseExecutor,
  ) {
    return selectAssignedSiteLocation(
      resolveExecutor(executor),
      companyId,
      userId,
      siteLocationId,
    );
  },

  findPrimaryOfficeLocation(companyId: string, executor?: DatabaseExecutor) {
    return selectPrimaryOfficeLocation(resolveExecutor(executor), companyId);
  },

  async createAttendanceQrSession(input: {
    companyId: string;
    employeeId: string;
    officeLocationId: string;
    action: AttendanceQrAction;
    tokenHash: string;
    expiresAt: string;
  }) {
    const result = await query<AttendanceQrSessionRow>(
      `
        INSERT INTO attendance_qr_sessions (
          id,
          company_id,
          employee_id,
          office_location_id,
          action,
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
          $4,
          $5,
          'pending',
          $6,
          $7::timestamptz,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          company_id AS "companyId",
          employee_id AS "employeeId",
          office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          NULL::double precision AS "officeLocationRadiusMeters",
          attendance_record_id AS "attendanceRecordId",
          action,
          status,
          token_hash AS "tokenHash",
          expires_at AS "expiresAt",
          verified_at AS "verifiedAt",
          verified_latitude AS "verifiedLatitude",
          verified_longitude AS "verifiedLongitude",
          verified_accuracy_meters AS "verifiedAccuracyMeters",
          verified_distance_meters AS "verifiedDistanceMeters",
          failure_reason AS "failureReason",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.employeeId,
        input.officeLocationId,
        input.action,
        input.tokenHash,
        input.expiresAt,
      ],
    );

    return mapAttendanceQrSession(result.rows[0]);
  },

  findAttendanceQrSessionById(
    sessionId: string,
    options?: {
      companyId?: string;
      employeeId?: string;
    },
    executor?: DatabaseExecutor,
  ) {
    return selectAttendanceQrSessionById(
      resolveExecutor(executor),
      sessionId,
      options,
    );
  },

  lockAttendanceQrSessionById(
    sessionId: string,
    options: {
      companyId?: string;
      employeeId?: string;
    },
    executor: DatabaseExecutor,
  ) {
    return selectAttendanceQrSessionById(executor, sessionId, {
      ...options,
      forUpdate: true,
    });
  },

  async updateAttendanceQrSession(
    input: {
      sessionId: string;
      companyId: string;
      employeeId?: string;
      status?: AttendanceQrSessionStatus;
      attendanceRecordId?: string | null;
      verifiedAt?: string | null;
      verifiedLatitude?: number | null;
      verifiedLongitude?: number | null;
      verifiedAccuracyMeters?: number | null;
      verifiedDistanceMeters?: number | null;
      failureReason?: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AttendanceQrSessionRow>(
      `
        UPDATE attendance_qr_sessions
        SET
          status = COALESCE($4::text, status),
          attendance_record_id = COALESCE($5::text, attendance_record_id),
          verified_at = COALESCE($6::timestamptz, verified_at),
          verified_latitude = COALESCE($7::double precision, verified_latitude),
          verified_longitude = COALESCE($8::double precision, verified_longitude),
          verified_accuracy_meters = COALESCE($9::double precision, verified_accuracy_meters),
          verified_distance_meters = COALESCE($10::double precision, verified_distance_meters),
          failure_reason = CASE
            WHEN $11::text IS NULL THEN failure_reason
            ELSE $11::text
          END,
          updated_at = NOW()
        WHERE id = $1
          AND company_id = $2
          AND ($3::text IS NULL OR employee_id = $3)
        RETURNING
          id,
          company_id AS "companyId",
          employee_id AS "employeeId",
          office_location_id AS "officeLocationId",
          NULL::text AS "officeLocationName",
          NULL::double precision AS "officeLocationRadiusMeters",
          attendance_record_id AS "attendanceRecordId",
          action,
          status,
          token_hash AS "tokenHash",
          expires_at AS "expiresAt",
          verified_at AS "verifiedAt",
          verified_latitude AS "verifiedLatitude",
          verified_longitude AS "verifiedLongitude",
          verified_accuracy_meters AS "verifiedAccuracyMeters",
          verified_distance_meters AS "verifiedDistanceMeters",
          failure_reason AS "failureReason",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        input.sessionId,
        input.companyId,
        input.employeeId ?? null,
        input.status ?? null,
        input.attendanceRecordId ?? null,
        input.verifiedAt ?? null,
        input.verifiedLatitude ?? null,
        input.verifiedLongitude ?? null,
        input.verifiedAccuracyMeters ?? null,
        input.verifiedDistanceMeters ?? null,
        input.failureReason ?? null,
      ],
    );

    return mapAttendanceQrSession(result.rows[0]);
  },

  async getCompanyAttendanceSettings(companyId: string, executor?: DatabaseExecutor) {
    await ensureAttendanceSettings(companyId, executor);
    const result = await resolveExecutor(executor).query<AttendanceSettingsRow>(
      `
        SELECT
          default_shift_start::text AS "defaultShiftStart",
          default_shift_end::text AS "defaultShiftEnd",
          grace_time_minutes AS "graceTimeMinutes",
          half_day_threshold_minutes AS "halfDayThresholdMinutes",
          full_day_threshold_minutes AS "fullDayThresholdMinutes",
          overtime_threshold_minutes AS "overtimeThresholdMinutes",
          geofence_required AS "geofenceRequired",
          allow_browser_gps_fallback AS "allowBrowserGpsFallback",
          remote_attendance_allowed AS "remoteAttendanceAllowed",
          field_visit_attendance_allowed AS "fieldVisitAttendanceAllowed",
          break_tracking_allowed AS "breakTrackingAllowed"
        FROM company_attendance_settings
        WHERE company_id = $1
        LIMIT 1
      `,
      [companyId],
    );

    return result.rows[0] ?? null;
  },

  async findEmployeeBiometricDevice(
    companyId: string,
    userId: string,
    officeLocationId: string | null,
  ) {
    const result = await query<BiometricDeviceRow>(
      `
        SELECT
          biometric_devices.id,
          biometric_devices.name,
          biometric_devices.status,
          biometric_devices.office_location_id AS "officeLocationId",
          office_locations.name AS "officeLocationName",
          biometric_devices.device_type AS "deviceType",
          biometric_devices.serial_number AS "serialNumber",
          biometric_devices.last_sync_at AS "lastSyncAt",
          biometric_devices.sync_interval_minutes AS "syncIntervalMinutes"
        FROM biometric_devices
        LEFT JOIN office_locations
          ON office_locations.id = biometric_devices.office_location_id
        LEFT JOIN employee_biometric_mappings
          ON employee_biometric_mappings.biometric_device_id = biometric_devices.id
          AND employee_biometric_mappings.company_id = biometric_devices.company_id
          AND employee_biometric_mappings.user_id = $2
          AND employee_biometric_mappings.is_active = TRUE
        WHERE biometric_devices.company_id = $1
          AND biometric_devices.is_active = TRUE
          AND (
            employee_biometric_mappings.id IS NOT NULL
            OR ($3::text IS NOT NULL AND biometric_devices.office_location_id = $3)
            OR biometric_devices.office_location_id IS NULL
          )
        ORDER BY
          CASE
            WHEN employee_biometric_mappings.id IS NOT NULL THEN 0
            WHEN biometric_devices.office_location_id = $3 THEN 1
            ELSE 2
          END,
          biometric_devices.updated_at DESC
        LIMIT 1
      `,
      [companyId, userId, officeLocationId],
    );

    return mapBiometricDevice(result.rows[0]);
  },

  async insertAttendanceRecord(
    input: {
      companyId: string;
      userId: string;
      attendanceDate: string;
      checkInAt: string | null;
      checkOutAt: string | null;
      status: AttendanceRecordStatus;
      source: AttendanceSource;
      officeLocationId: string | null;
      siteLocationId: string | null;
      projectId: string | null;
      biometricDeviceId: string | null;
      notes: string | null;
      checkInProof?: AttendanceLocationProof | null;
      checkOutProof?: AttendanceLocationProof | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AttendanceRecordRow>(
      `
        INSERT INTO attendance_records (
          id,
          company_id,
          user_id,
          attendance_date,
          check_in_at,
          check_out_at,
          status,
          source,
          office_location_id,
          site_location_id,
          project_id,
          biometric_device_id,
          notes,
          check_in_latitude,
          check_in_longitude,
          check_in_accuracy_meters,
          check_in_distance_meters,
          check_in_verification_source,
          check_out_latitude,
          check_out_longitude,
          check_out_accuracy_meters,
          check_out_distance_meters,
          check_out_verification_source,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::date,
          $5::timestamptz,
          $6::timestamptz,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22,
          $23,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          user_id AS "userId",
          attendance_date::text AS "attendanceDate",
          check_in_at AS "checkInAt",
          check_out_at AS "checkOutAt",
          check_in_latitude AS "checkInLatitude",
          check_in_longitude AS "checkInLongitude",
          check_in_accuracy_meters AS "checkInAccuracyMeters",
          check_in_distance_meters AS "checkInDistanceMeters",
          check_in_verification_source AS "checkInVerificationSource",
          check_out_latitude AS "checkOutLatitude",
          check_out_longitude AS "checkOutLongitude",
          check_out_accuracy_meters AS "checkOutAccuracyMeters",
          check_out_distance_meters AS "checkOutDistanceMeters",
          check_out_verification_source AS "checkOutVerificationSource",
          status,
          source,
          office_location_id AS "locationId",
          NULL::text AS "locationName",
          site_location_id AS "siteLocationId",
          NULL::text AS "siteLocationName",
          project_id AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS "clientName",
          biometric_device_id AS "deviceId",
          NULL::text AS "deviceName",
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.userId,
        input.attendanceDate,
        input.checkInAt,
        input.checkOutAt,
        input.status,
        input.source,
        input.officeLocationId,
        input.siteLocationId,
        input.projectId,
        input.biometricDeviceId,
        input.notes,
        input.checkInProof?.latitude ?? null,
        input.checkInProof?.longitude ?? null,
        input.checkInProof?.accuracyMeters ?? null,
        input.checkInProof?.distanceMeters ?? null,
        input.checkInProof?.verificationSource ?? null,
        input.checkOutProof?.latitude ?? null,
        input.checkOutProof?.longitude ?? null,
        input.checkOutProof?.accuracyMeters ?? null,
        input.checkOutProof?.distanceMeters ?? null,
        input.checkOutProof?.verificationSource ?? null,
      ],
    );

    return mapAttendanceRecord(result.rows[0]);
  },

  async updateAttendanceRecord(
    input: {
      companyId: string;
      userId: string;
      attendanceId: string;
      checkInAt: string | null;
      checkOutAt: string | null;
      status: AttendanceRecordStatus;
      source: AttendanceSource;
      officeLocationId: string | null;
      siteLocationId: string | null;
      projectId: string | null;
      biometricDeviceId: string | null;
      notes: string | null;
      checkInProof?: AttendanceLocationProof | null;
      checkOutProof?: AttendanceLocationProof | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AttendanceRecordRow>(
      `
        UPDATE attendance_records
        SET
          check_in_at = $4::timestamptz,
          check_out_at = $5::timestamptz,
          status = $6,
          source = $7,
          office_location_id = $8,
          site_location_id = $9,
          project_id = $10,
          biometric_device_id = $11,
          notes = $12,
          check_in_latitude = COALESCE($13::double precision, check_in_latitude),
          check_in_longitude = COALESCE($14::double precision, check_in_longitude),
          check_in_accuracy_meters = COALESCE($15::double precision, check_in_accuracy_meters),
          check_in_distance_meters = COALESCE($16::double precision, check_in_distance_meters),
          check_in_verification_source = COALESCE($17::text, check_in_verification_source),
          check_out_latitude = COALESCE($18::double precision, check_out_latitude),
          check_out_longitude = COALESCE($19::double precision, check_out_longitude),
          check_out_accuracy_meters = COALESCE($20::double precision, check_out_accuracy_meters),
          check_out_distance_meters = COALESCE($21::double precision, check_out_distance_meters),
          check_out_verification_source = COALESCE($22::text, check_out_verification_source),
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          user_id AS "userId",
          attendance_date::text AS "attendanceDate",
          check_in_at AS "checkInAt",
          check_out_at AS "checkOutAt",
          check_in_latitude AS "checkInLatitude",
          check_in_longitude AS "checkInLongitude",
          check_in_accuracy_meters AS "checkInAccuracyMeters",
          check_in_distance_meters AS "checkInDistanceMeters",
          check_in_verification_source AS "checkInVerificationSource",
          check_out_latitude AS "checkOutLatitude",
          check_out_longitude AS "checkOutLongitude",
          check_out_accuracy_meters AS "checkOutAccuracyMeters",
          check_out_distance_meters AS "checkOutDistanceMeters",
          check_out_verification_source AS "checkOutVerificationSource",
          status,
          source,
          office_location_id AS "locationId",
          NULL::text AS "locationName",
          site_location_id AS "siteLocationId",
          NULL::text AS "siteLocationName",
          project_id AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS "clientName",
          biometric_device_id AS "deviceId",
          NULL::text AS "deviceName",
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        input.companyId,
        input.userId,
        input.attendanceId,
        input.checkInAt,
        input.checkOutAt,
        input.status,
        input.source,
        input.officeLocationId,
        input.siteLocationId,
        input.projectId,
        input.biometricDeviceId,
        input.notes,
        input.checkInProof?.latitude ?? null,
        input.checkInProof?.longitude ?? null,
        input.checkInProof?.accuracyMeters ?? null,
        input.checkInProof?.distanceMeters ?? null,
        input.checkInProof?.verificationSource ?? null,
        input.checkOutProof?.latitude ?? null,
        input.checkOutProof?.longitude ?? null,
        input.checkOutProof?.accuracyMeters ?? null,
        input.checkOutProof?.distanceMeters ?? null,
        input.checkOutProof?.verificationSource ?? null,
      ],
    );

    return mapAttendanceRecord(result.rows[0]);
  },

  async ensureAttendanceRecordForDate(
    input: {
      companyId: string;
      userId: string;
      attendanceDate: string;
      status: AttendanceRecordStatus;
      source: AttendanceSource;
      officeLocationId: string | null;
      siteLocationId: string | null;
      projectId: string | null;
      biometricDeviceId: string | null;
      notes: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const resolvedExecutor = resolveExecutor(executor);
    const existing = await selectAttendanceRecordByDate(
      resolvedExecutor,
      input.companyId,
      input.userId,
      input.attendanceDate,
    );

    if (existing) {
      return existing;
    }

    return this.insertAttendanceRecord(
      {
        ...input,
        checkInAt: null,
        checkOutAt: null,
      },
      resolvedExecutor,
    );
  },

  async checkIn(input: {
    companyId: string;
    userId: string;
    attendanceDate: string;
    occurredAt: string;
    status: AttendanceRecordStatus;
    source: AttendanceSource;
    officeLocationId: string | null;
    siteLocationId: string | null;
    projectId: string | null;
    biometricDeviceId: string | null;
    notes: string | null;
    checkInProof?: AttendanceLocationProof | null;
  }) {
    return withTransaction(async (client) => {
      const existingRecord = await selectAttendanceRecordByDate(
        client,
        input.companyId,
        input.userId,
        input.attendanceDate,
        true,
      );

      if (existingRecord?.checkOutAt) {
        return {
          kind: "already-completed" as const,
          record: existingRecord,
        };
      }

      if (existingRecord?.checkInAt) {
        return {
          kind: "already-open" as const,
          record: existingRecord,
        };
      }

      const record = existingRecord
        ? await this.updateAttendanceRecord(
            {
              companyId: input.companyId,
              userId: input.userId,
              attendanceId: existingRecord.id,
              checkInAt: input.occurredAt,
              checkOutAt: existingRecord.checkOutAt,
              status: input.status,
              source: input.source,
              officeLocationId: input.officeLocationId,
              siteLocationId: input.siteLocationId,
              projectId: input.projectId,
              biometricDeviceId: input.biometricDeviceId,
              notes: input.notes,
              checkInProof: input.checkInProof ?? null,
            },
            client,
          )
        : await this.insertAttendanceRecord(
            {
              companyId: input.companyId,
              userId: input.userId,
              attendanceDate: input.attendanceDate,
              checkInAt: input.occurredAt,
              checkOutAt: null,
              status: input.status,
              source: input.source,
              officeLocationId: input.officeLocationId,
              siteLocationId: input.siteLocationId,
              projectId: input.projectId,
              biometricDeviceId: input.biometricDeviceId,
              notes: input.notes,
              checkInProof: input.checkInProof ?? null,
            },
            client,
          );

      return {
        kind: existingRecord ? ("updated-missing" as const) : ("created" as const),
        record,
      };
    });
  },

  async checkOut(input: {
    companyId: string;
    userId: string;
    attendanceDate: string;
    occurredAt: string;
    status: AttendanceRecordStatus;
    source: AttendanceSource;
    officeLocationId: string | null;
    siteLocationId: string | null;
    projectId: string | null;
    biometricDeviceId: string | null;
    notes: string | null;
    checkOutProof?: AttendanceLocationProof | null;
  }) {
    return withTransaction(async (client) => {
      const existingRecord = await selectAttendanceRecordByDate(
        client,
        input.companyId,
        input.userId,
        input.attendanceDate,
        true,
      );

      if (!existingRecord || !existingRecord.checkInAt) {
        return {
          kind: "not-started" as const,
        };
      }

      if (existingRecord.checkOutAt) {
        return {
          kind: "already-completed" as const,
          record: existingRecord,
        };
      }

      const record = await this.updateAttendanceRecord(
        {
          companyId: input.companyId,
          userId: input.userId,
          attendanceId: existingRecord.id,
          checkInAt: existingRecord.checkInAt,
          checkOutAt: input.occurredAt,
          status: input.status,
          source: input.source,
          officeLocationId: input.officeLocationId ?? existingRecord.locationId,
          siteLocationId: input.siteLocationId ?? existingRecord.siteLocationId,
          projectId: input.projectId ?? existingRecord.projectId,
          biometricDeviceId: input.biometricDeviceId ?? existingRecord.deviceId,
          notes: input.notes ?? existingRecord.notes,
          checkOutProof: input.checkOutProof ?? null,
        },
        client,
      );

      return {
        kind: "updated" as const,
        record,
      };
    });
  },
};
