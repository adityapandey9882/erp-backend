import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole } from "../roles/roles.types.js";
import { getUserAccountStatus } from "../users/users.types.js";
import type {
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceSource,
} from "../attendance/attendance.types.js";
import type {
  AttendanceCorrectionRecord,
  AttendanceCorrectionRequestType,
  AttendanceCorrectionStatus,
} from "./attendance-corrections.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type AttendanceCorrectionRow = {
  id: string;
  companyId: string;
  userId: string;
  attendanceId: string;
  attendanceDate: string;
  requestType: AttendanceCorrectionRequestType;
  requestedCheckIn: Date | string | null;
  requestedCheckOut: Date | string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  approverId: string | null;
  approvedAt: Date | string | null;
  rejectionReason: string | null;
  currentAttendanceStatus: AttendanceRecordStatus;
  currentAttendanceSource: AttendanceSource;
  currentCheckInAt: Date | string | null;
  currentCheckOutAt: Date | string | null;
  currentCheckInLatitude: number | null;
  currentCheckInLongitude: number | null;
  currentCheckInAccuracyMeters: number | null;
  currentCheckInDistanceMeters: number | null;
  currentCheckInVerificationSource: AttendanceRecord["checkInVerificationSource"];
  currentCheckOutLatitude: number | null;
  currentCheckOutLongitude: number | null;
  currentCheckOutAccuracyMeters: number | null;
  currentCheckOutDistanceMeters: number | null;
  currentCheckOutVerificationSource: AttendanceRecord["checkOutVerificationSource"];
  currentLocationId: string | null;
  currentLocationName: string | null;
  currentSiteLocationId: string | null;
  currentSiteLocationName: string | null;
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentClientName: string | null;
  currentDeviceId: string | null;
  currentDeviceName: string | null;
  currentNotes: string | null;
  attendanceCreatedAt: Date | string;
  attendanceUpdatedAt: Date | string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

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
  checkInVerificationSource: AttendanceRecord["checkInVerificationSource"];
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracyMeters: number | null;
  checkOutDistanceMeters: number | null;
  checkOutVerificationSource: AttendanceRecord["checkOutVerificationSource"];
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

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapAttendanceRecord(
  row: Pick<
    AttendanceCorrectionRow,
    | "attendanceId"
    | "userId"
    | "attendanceDate"
    | "currentCheckInAt"
    | "currentCheckOutAt"
    | "currentAttendanceStatus"
    | "currentAttendanceSource"
    | "currentLocationId"
    | "currentLocationName"
    | "currentSiteLocationId"
    | "currentSiteLocationName"
    | "currentProjectId"
    | "currentProjectName"
    | "currentClientName"
    | "currentDeviceId"
    | "currentDeviceName"
    | "currentNotes"
    | "currentCheckInLatitude"
    | "currentCheckInLongitude"
    | "currentCheckInAccuracyMeters"
    | "currentCheckInDistanceMeters"
    | "currentCheckInVerificationSource"
    | "currentCheckOutLatitude"
    | "currentCheckOutLongitude"
    | "currentCheckOutAccuracyMeters"
    | "currentCheckOutDistanceMeters"
    | "currentCheckOutVerificationSource"
    | "attendanceCreatedAt"
    | "attendanceUpdatedAt"
  >,
): AttendanceRecord {
  const durationMinutes =
    row.currentCheckInAt !== null && row.currentCheckOutAt !== null
      ? Math.max(
          0,
          Math.round(
            (new Date(row.currentCheckOutAt).getTime() -
              new Date(row.currentCheckInAt).getTime()) /
              60000,
          ),
        )
      : null;

  return {
    id: row.attendanceId,
    userId: row.userId,
    attendanceDate: row.attendanceDate,
    checkInAt: row.currentCheckInAt ? toIsoString(row.currentCheckInAt) : null,
    checkOutAt: row.currentCheckOutAt ? toIsoString(row.currentCheckOutAt) : null,
    checkInLatitude: row.currentCheckInLatitude,
    checkInLongitude: row.currentCheckInLongitude,
    checkInAccuracyMeters: row.currentCheckInAccuracyMeters,
    checkInDistanceMeters: row.currentCheckInDistanceMeters,
    checkInVerificationSource: row.currentCheckInVerificationSource,
    checkOutLatitude: row.currentCheckOutLatitude,
    checkOutLongitude: row.currentCheckOutLongitude,
    checkOutAccuracyMeters: row.currentCheckOutAccuracyMeters,
    checkOutDistanceMeters: row.currentCheckOutDistanceMeters,
    checkOutVerificationSource: row.currentCheckOutVerificationSource,
    status: row.currentAttendanceStatus,
    source: row.currentAttendanceSource,
    locationId: row.currentLocationId,
    locationName: row.currentLocationName,
    siteLocationId: row.currentSiteLocationId,
    siteLocationName: row.currentSiteLocationName,
    projectId: row.currentProjectId,
    projectName: row.currentProjectName,
    clientName: row.currentClientName,
    deviceId: row.currentDeviceId,
    deviceName: row.currentDeviceName,
    notes: row.currentNotes,
    durationMinutes,
    createdAt: toIsoString(row.attendanceCreatedAt),
    updatedAt: toIsoString(row.attendanceUpdatedAt),
  };
}

function mapAttendanceRecordRow(row: AttendanceRecordRow): AttendanceRecord {
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

function mapCorrectionRow(
  row: AttendanceCorrectionRow | undefined,
): AttendanceCorrectionRecord | null {
  if (!row || !isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    attendanceId: row.attendanceId,
    attendanceDate: row.attendanceDate,
    requestType: row.requestType,
    employee: {
      id: row.userId,
      fullName: row.fullName,
      email: row.email.toLowerCase(),
      role: row.role,
      status: getUserAccountStatus(row.isActive),
      department: row.departmentId
        ? {
            id: row.departmentId,
            name: row.departmentName ?? "Unknown Department",
            code: row.departmentCode ?? "",
          }
        : null,
      designation: row.designationId
        ? {
            id: row.designationId,
            title: row.designationTitle ?? "Unknown Designation",
            code: row.designationCode ?? "",
            department: row.designationDepartmentId
              ? {
                  id: row.designationDepartmentId,
                  name: row.designationDepartmentName ?? "Unknown Department",
                  code: row.designationDepartmentCode ?? "",
                }
              : null,
          }
        : null,
    },
    attendance: mapAttendanceRecord(row),
    requestedCheckIn: row.requestedCheckIn ? toIsoString(row.requestedCheckIn) : null,
    requestedCheckOut: row.requestedCheckOut
      ? toIsoString(row.requestedCheckOut)
      : null,
    reason: row.reason,
    status: row.status,
    approverId: row.approverId,
    approvedAt: row.approvedAt ? toIsoString(row.approvedAt) : null,
    rejectionReason: row.rejectionReason,
    approvalProgress: null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const correctionSelect = `
  SELECT
    attendance_corrections.id,
    attendance_corrections.company_id AS "companyId",
    attendance_corrections.user_id AS "userId",
    attendance_corrections.attendance_id AS "attendanceId",
    attendance_corrections.attendance_date::text AS "attendanceDate",
    attendance_corrections.request_type AS "requestType",
    attendance_corrections.requested_check_in AS "requestedCheckIn",
    attendance_corrections.requested_check_out AS "requestedCheckOut",
    attendance_corrections.reason,
    attendance_corrections.status,
    attendance_corrections.approver_id AS "approverId",
    attendance_corrections.approved_at AS "approvedAt",
    attendance_corrections.rejection_reason AS "rejectionReason",
    attendance_corrections.created_at AS "createdAt",
    attendance_corrections.updated_at AS "updatedAt",
    attendance_records.status AS "currentAttendanceStatus",
    attendance_records.source AS "currentAttendanceSource",
    attendance_records.check_in_at AS "currentCheckInAt",
    attendance_records.check_out_at AS "currentCheckOutAt",
    attendance_records.check_in_latitude AS "currentCheckInLatitude",
    attendance_records.check_in_longitude AS "currentCheckInLongitude",
    attendance_records.check_in_accuracy_meters AS "currentCheckInAccuracyMeters",
    attendance_records.check_in_distance_meters AS "currentCheckInDistanceMeters",
    attendance_records.check_in_verification_source AS "currentCheckInVerificationSource",
    attendance_records.check_out_latitude AS "currentCheckOutLatitude",
    attendance_records.check_out_longitude AS "currentCheckOutLongitude",
    attendance_records.check_out_accuracy_meters AS "currentCheckOutAccuracyMeters",
    attendance_records.check_out_distance_meters AS "currentCheckOutDistanceMeters",
    attendance_records.check_out_verification_source AS "currentCheckOutVerificationSource",
    attendance_records.office_location_id AS "currentLocationId",
    office_locations.name AS "currentLocationName",
    attendance_records.site_location_id AS "currentSiteLocationId",
    site_locations.name AS "currentSiteLocationName",
    attendance_records.project_id AS "currentProjectId",
    projects.name AS "currentProjectName",
    COALESCE(site_locations.client_name, projects.client_name) AS "currentClientName",
    attendance_records.biometric_device_id AS "currentDeviceId",
    biometric_devices.name AS "currentDeviceName",
    attendance_records.notes AS "currentNotes",
    attendance_records.created_at AS "attendanceCreatedAt",
    attendance_records.updated_at AS "attendanceUpdatedAt",
    users.full_name AS "fullName",
    users.email,
    users.role,
    users.is_active AS "isActive",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode"
  FROM attendance_corrections
  INNER JOIN attendance_records
    ON attendance_records.id = attendance_corrections.attendance_id
    AND attendance_records.company_id = attendance_corrections.company_id
    AND attendance_records.user_id = attendance_corrections.user_id
  INNER JOIN users
    ON users.id = attendance_corrections.user_id
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
  LEFT JOIN departments
    ON departments.id = users.department_id
    AND departments.company_id = attendance_corrections.company_id
  LEFT JOIN designations
    ON designations.id = users.designation_id
    AND designations.company_id = attendance_corrections.company_id
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = attendance_corrections.company_id
`;

export const attendanceCorrectionsRepository = {
  async listEmployeeCorrections(companyId: string, userId: string) {
    const result = await query<AttendanceCorrectionRow>(
      `
        ${correctionSelect}
        WHERE attendance_corrections.company_id = $1
          AND attendance_corrections.user_id = $2
        ORDER BY attendance_corrections.created_at DESC, attendance_corrections.id DESC
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapCorrectionRow(row))
      .filter((row): row is AttendanceCorrectionRecord => row !== null);
  },

  async listCompanyCorrections(companyId: string) {
    const result = await query<AttendanceCorrectionRow>(
      `
        ${correctionSelect}
        WHERE attendance_corrections.company_id = $1
        ORDER BY attendance_corrections.created_at DESC, attendance_corrections.id DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapCorrectionRow(row))
      .filter((row): row is AttendanceCorrectionRecord => row !== null);
  },

  async findCorrectionById(
    companyId: string,
    correctionId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AttendanceCorrectionRow>(
      `
        ${correctionSelect}
        WHERE attendance_corrections.company_id = $1
          AND attendance_corrections.id = $2
        LIMIT 1
      `,
      [companyId, correctionId],
    );

    return mapCorrectionRow(result.rows[0]);
  },

  async findAttendanceRecordForUser(
    companyId: string,
    userId: string,
    attendanceId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AttendanceRecordRow>(
      `
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
        WHERE attendance_records.company_id = $1
          AND attendance_records.user_id = $2
          AND attendance_records.id = $3
        LIMIT 1
      `,
      [companyId, userId, attendanceId],
    );

    return result.rows[0] ? mapAttendanceRecordRow(result.rows[0]) : null;
  },

  async createCorrection(
    input: {
      companyId: string;
      userId: string;
      attendanceId: string;
      attendanceDate: string;
      requestType: AttendanceCorrectionRequestType;
      requestedCheckIn: string | null;
      requestedCheckOut: string | null;
      reason: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO attendance_corrections (
          id,
          company_id,
          user_id,
          attendance_id,
          attendance_date,
          request_type,
          requested_check_in,
          requested_check_out,
          reason,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::date,
          $6,
          $7::timestamptz,
          $8::timestamptz,
          $9,
          'pending',
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.userId,
        input.attendanceId,
        input.attendanceDate,
        input.requestType,
        input.requestedCheckIn,
        input.requestedCheckOut,
        input.reason,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateCorrectionStatus(
    companyId: string,
    correctionId: string,
    input: {
      status: AttendanceCorrectionStatus;
      approverId?: string | null;
      approvedAt?: string | null;
      rejectionReason?: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE attendance_corrections
        SET
          status = $3,
          approver_id = $4,
          approved_at = $5::timestamptz,
          rejection_reason = $6,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
          AND status = 'pending'
        RETURNING id
      `,
      [
        companyId,
        correctionId,
        input.status,
        input.approverId ?? null,
        input.approvedAt ?? null,
        input.rejectionReason ?? null,
      ],
    );

    return result.rows[0]?.id ?? null;
  },
};
