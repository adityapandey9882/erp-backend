import { query } from "../../database/index.js";
import { ROLE_DEFINITIONS, type AppRole } from "../roles/roles.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  AdminOverviewActivityItem,
  AdminOverviewAnnouncement,
  AdminOverviewOffice,
  AdminOverviewSystemHealth,
  AdminRoleSummary,
} from "./admin.types.js";

type CompanyUserSummaryRow = {
  role: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
};

export type AdminAttendanceSummary = {
  attendanceDate: string;
  totalEmployees: number;
  totalActiveEmployees: number;
  employeeGrowth: number;
  presentToday: number;
  presentYesterday: number;
  lateToday: number;
  lateYesterday: number;
  leaveToday: number;
  leaveYesterday: number;
  notCheckedInToday: number;
  absentToday: number;
  absentYesterday: number;
  activeNow: number;
  averageCheckInMinutes: number | null;
  averageCheckOutMinutes: number | null;
  totalWorkedMinutes: number;
  overtimeMinutes: number;
  frequentLateEmployees: number;
  anomalyCount: number;
};

export type AdminPendingActionCounts = {
  leaveRequests: number;
  attendanceCorrections: number;
  documentApprovals: number;
  salaryApprovals: number;
  resignationRequests: number;
};

export type AdminCompanySnapshotCounts = {
  totalOffices: number;
  departments: number;
};

type AttendanceSummaryRow = {
  attendanceDate: string;
  totalEmployees: number | string;
  totalActiveEmployees: number | string;
  employeeGrowth: number | string;
  presentToday: number | string;
  presentYesterday: number | string;
  lateToday: number | string;
  lateYesterday: number | string;
  leaveToday: number | string;
  leaveYesterday: number | string;
  notCheckedInToday: number | string;
  absentToday: number | string;
  absentYesterday: number | string;
  activeNow: number | string;
  averageCheckInMinutes: number | string | null;
  averageCheckOutMinutes: number | string | null;
  totalWorkedMinutes: number | string | null;
  overtimeMinutes: number | string | null;
  frequentLateEmployees: number | string;
  anomalyCount: number | string;
};

type ActivityRow = {
  id: string;
  employeeName: string;
  employeeEmail: string;
  action: AdminOverviewActivityItem["action"];
  occurredAt: Date | string;
};

type PendingActionCountsRow = {
  leaveRequests: number | string;
  attendanceCorrections: number | string;
  documentApprovals: number | string;
  salaryApprovals: number | string;
  resignationRequests: number | string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  priority: AdminOverviewAnnouncement["priority"];
  publishedAt: Date | string | null;
  createdAt: Date | string;
  postedBy: string | null;
};

type OfficeRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isPrimary: boolean;
};

type SnapshotCountsRow = {
  totalOffices: number | string;
  departments: number | string;
};

type SystemHealthRow = {
  usedBytes: number | string | null;
  quotaBytes: number | string | null;
  emailNotifications: boolean | null;
  lastBackupAt: Date | string | null;
};

const DEFAULT_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapRoleSummary(row: CompanyUserSummaryRow): AdminRoleSummary | null {
  if (!isAppRole(row.role) || row.role === "superadmin") {
    return null;
  }

  const role = row.role as AppRole;

  return {
    role,
    label: ROLE_DEFINITIONS[role].label,
    totalUsers: row.totalUsers,
    activeUsers: row.activeUsers,
    inactiveUsers: row.inactiveUsers,
  };
}

function mapAttendanceSummary(
  row: AttendanceSummaryRow | undefined,
): AdminAttendanceSummary {
  return {
    attendanceDate: row?.attendanceDate ?? "",
    totalEmployees: toNumber(row?.totalEmployees),
    totalActiveEmployees: toNumber(row?.totalActiveEmployees),
    employeeGrowth: toNumber(row?.employeeGrowth),
    presentToday: toNumber(row?.presentToday),
    presentYesterday: toNumber(row?.presentYesterday),
    lateToday: toNumber(row?.lateToday),
    lateYesterday: toNumber(row?.lateYesterday),
    leaveToday: toNumber(row?.leaveToday),
    leaveYesterday: toNumber(row?.leaveYesterday),
    notCheckedInToday: toNumber(row?.notCheckedInToday),
    absentToday: toNumber(row?.absentToday),
    absentYesterday: toNumber(row?.absentYesterday),
    activeNow: toNumber(row?.activeNow),
    averageCheckInMinutes:
      row?.averageCheckInMinutes === null ||
      row?.averageCheckInMinutes === undefined
        ? null
        : toNumber(row.averageCheckInMinutes),
    averageCheckOutMinutes:
      row?.averageCheckOutMinutes === null ||
      row?.averageCheckOutMinutes === undefined
        ? null
        : toNumber(row.averageCheckOutMinutes),
    totalWorkedMinutes: toNumber(row?.totalWorkedMinutes),
    overtimeMinutes: toNumber(row?.overtimeMinutes),
    frequentLateEmployees: toNumber(row?.frequentLateEmployees),
    anomalyCount: toNumber(row?.anomalyCount),
  };
}

function mapActivity(row: ActivityRow): AdminOverviewActivityItem {
  return {
    id: row.id,
    employeeName: row.employeeName,
    employeeEmail: row.employeeEmail.toLowerCase(),
    action: row.action,
    occurredAt: toIsoString(row.occurredAt),
  };
}

function buildAnnouncementSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 139).trimEnd()}...`;
}

function mapAnnouncement(row: AnnouncementRow): AdminOverviewAnnouncement {
  return {
    id: row.id,
    title: row.title,
    summary: buildAnnouncementSummary(row.content),
    priority: row.priority,
    publishedAt: toIsoString(row.publishedAt ?? row.createdAt),
    postedBy: row.postedBy ?? "Admin",
  };
}

function mapOffice(row: OfficeRow | undefined): AdminOverviewOffice | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    isPrimary: row.isPrimary,
  };
}

function mapSystemHealth(row: SystemHealthRow | undefined): AdminOverviewSystemHealth {
  const usedBytes = toNumber(row?.usedBytes);
  const quotaBytes = Math.max(toNumber(row?.quotaBytes) || DEFAULT_STORAGE_QUOTA_BYTES, 1);
  const usedPercent = Math.min(
    100,
    Math.max(0, Math.round((usedBytes / quotaBytes) * 100)),
  );
  const emailEnabled = row?.emailNotifications ?? true;
  const lastBackupAt = row?.lastBackupAt ? toIsoString(row.lastBackupAt) : null;

  return {
    database: {
      status: "healthy",
      label: "Healthy",
    },
    storage: {
      usedBytes,
      quotaBytes,
      usedPercent,
    },
    emailService: {
      status: emailEnabled ? "active" : "disabled",
      label: emailEnabled ? "Active" : "Disabled",
    },
    backup: {
      status: lastBackupAt ? "successful" : "not-configured",
      label: lastBackupAt ? "Successful" : "Not configured",
      lastBackupAt,
    },
  };
}

export const adminRepository = {
  async getCompanyUserSummary(companyId: string) {
    const result = await query<CompanyUserSummaryRow>(
      `
        SELECT
          users.role,
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (WHERE users.is_active = TRUE)::int AS "activeUsers",
          COUNT(*) FILTER (WHERE users.is_active = FALSE)::int AS "inactiveUsers"
        FROM users
        LEFT JOIN LATERAL (
          SELECT company_id
          FROM company_admins
          WHERE admin_user_id = users.id
          ORDER BY updated_at DESC, created_at DESC, company_id ASC
          LIMIT 1
        ) AS admin_company ON users.role = 'admin'
        WHERE (
          CASE
            WHEN users.role = 'admin' THEN admin_company.company_id
            ELSE users.company_id
          END
        ) = $1
          AND users.role <> 'superadmin'
        GROUP BY users.role
        ORDER BY users.role ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapRoleSummary(row))
      .filter((row): row is AdminRoleSummary => row !== null);
  },

  async getAttendanceSummary(companyId: string) {
    const result = await query<AttendanceSummaryRow>(
      `
        WITH settings AS (
          SELECT
            COALESCE(company_attendance_settings.default_shift_start, '09:30'::time) AS default_shift_start,
            COALESCE(company_attendance_settings.grace_time_minutes, 15) AS grace_time_minutes,
            COALESCE(company_attendance_settings.overtime_threshold_minutes, 540) AS overtime_threshold_minutes
          FROM (SELECT $1::text AS company_id) AS company_context
          LEFT JOIN company_attendance_settings
            ON company_attendance_settings.company_id = company_context.company_id
        ),
        workforce AS (
          SELECT
            users.id,
            users.is_active,
            users.created_at
          FROM users
          WHERE users.company_id = $1
            AND users.role NOT IN ('superadmin', 'admin')
        ),
        active_workforce AS (
          SELECT *
          FROM workforce
          WHERE is_active = TRUE
        ),
        today_attendance AS (
          SELECT attendance_records.*
          FROM attendance_records
          INNER JOIN active_workforce
            ON active_workforce.id = attendance_records.user_id
          WHERE attendance_records.company_id = $1
            AND attendance_records.attendance_date = CURRENT_DATE
        ),
        yesterday_attendance AS (
          SELECT attendance_records.*
          FROM attendance_records
          INNER JOIN active_workforce
            ON active_workforce.id = attendance_records.user_id
          WHERE attendance_records.company_id = $1
            AND attendance_records.attendance_date = (CURRENT_DATE - INTERVAL '1 day')::date
        ),
        today_leave AS (
          SELECT DISTINCT leave_requests.user_id
          FROM leave_requests
          INNER JOIN active_workforce
            ON active_workforce.id = leave_requests.user_id
          WHERE leave_requests.company_id = $1
            AND leave_requests.status = 'approved'
            AND CURRENT_DATE BETWEEN leave_requests.start_date AND leave_requests.end_date
        ),
        yesterday_leave AS (
          SELECT DISTINCT leave_requests.user_id
          FROM leave_requests
          INNER JOIN active_workforce
            ON active_workforce.id = leave_requests.user_id
          WHERE leave_requests.company_id = $1
            AND leave_requests.status = 'approved'
            AND (CURRENT_DATE - INTERVAL '1 day')::date BETWEEN leave_requests.start_date AND leave_requests.end_date
        ),
        late_today AS (
          SELECT today_attendance.user_id
          FROM today_attendance
          CROSS JOIN settings
          WHERE today_attendance.check_in_at::time >
            settings.default_shift_start + settings.grace_time_minutes * INTERVAL '1 minute'
        ),
        late_yesterday AS (
          SELECT yesterday_attendance.user_id
          FROM yesterday_attendance
          CROSS JOIN settings
          WHERE yesterday_attendance.check_in_at::time >
            settings.default_shift_start + settings.grace_time_minutes * INTERVAL '1 minute'
        ),
        frequent_late AS (
          SELECT attendance_records.user_id
          FROM attendance_records
          INNER JOIN active_workforce
            ON active_workforce.id = attendance_records.user_id
          CROSS JOIN settings
          WHERE attendance_records.company_id = $1
            AND attendance_records.attendance_date >= date_trunc('week', CURRENT_DATE)::date
            AND attendance_records.check_in_at::time >
              settings.default_shift_start + settings.grace_time_minutes * INTERVAL '1 minute'
          GROUP BY attendance_records.user_id
          HAVING COUNT(*) >= 2
        ),
        anomaly_summary AS (
          SELECT
            (
              SELECT COUNT(*)::int
              FROM attendance_corrections
              WHERE attendance_corrections.company_id = $1
                AND attendance_corrections.status = 'pending'
            ) +
            (
              SELECT COUNT(*)::int
              FROM biometric_punch_logs
              WHERE biometric_punch_logs.company_id = $1
                AND biometric_punch_logs.sync_status = 'failed'
                AND biometric_punch_logs.created_at >= NOW() - INTERVAL '7 days'
            ) AS anomaly_count
        )
        SELECT
          CURRENT_DATE::text AS "attendanceDate",
          (SELECT COUNT(*)::int FROM workforce) AS "totalEmployees",
          (SELECT COUNT(*)::int FROM active_workforce) AS "totalActiveEmployees",
          (
            SELECT COUNT(*)::int
            FROM active_workforce
            WHERE active_workforce.created_at >= date_trunc('month', CURRENT_DATE)
          ) AS "employeeGrowth",
          (SELECT COUNT(*)::int FROM today_attendance) AS "presentToday",
          (SELECT COUNT(*)::int FROM yesterday_attendance) AS "presentYesterday",
          (SELECT COUNT(*)::int FROM late_today) AS "lateToday",
          (SELECT COUNT(*)::int FROM late_yesterday) AS "lateYesterday",
          (SELECT COUNT(*)::int FROM today_leave) AS "leaveToday",
          (SELECT COUNT(*)::int FROM yesterday_leave) AS "leaveYesterday",
          GREATEST(
            (SELECT COUNT(*)::int FROM active_workforce) -
            (SELECT COUNT(*)::int FROM today_attendance),
            0
          ) AS "notCheckedInToday",
          GREATEST(
            (SELECT COUNT(*)::int FROM active_workforce) -
            (SELECT COUNT(*)::int FROM today_attendance) -
            (SELECT COUNT(*)::int FROM today_leave),
            0
          ) AS "absentToday",
          GREATEST(
            (SELECT COUNT(*)::int FROM active_workforce) -
            (SELECT COUNT(*)::int FROM yesterday_attendance) -
            (SELECT COUNT(*)::int FROM yesterday_leave),
            0
          ) AS "absentYesterday",
          (
            SELECT COUNT(*)::int
            FROM today_attendance
            WHERE today_attendance.check_out_at IS NULL
          ) AS "activeNow",
          (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM today_attendance.check_in_at::time) / 60))::int
            FROM today_attendance
          ) AS "averageCheckInMinutes",
          (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM today_attendance.check_out_at::time) / 60))::int
            FROM today_attendance
            WHERE today_attendance.check_out_at IS NOT NULL
          ) AS "averageCheckOutMinutes",
          (
            SELECT COALESCE(
              ROUND(
                SUM(EXTRACT(EPOCH FROM (COALESCE(today_attendance.check_out_at, NOW()) - today_attendance.check_in_at)) / 60)
              )::int,
              0
            )
            FROM today_attendance
          ) AS "totalWorkedMinutes",
          (
            SELECT COALESCE(
              ROUND(
                SUM(
                  GREATEST(
                    EXTRACT(EPOCH FROM (COALESCE(today_attendance.check_out_at, NOW()) - today_attendance.check_in_at)) / 60 -
                    settings.overtime_threshold_minutes,
                    0
                  )
                )
              )::int,
              0
            )
            FROM today_attendance
            CROSS JOIN settings
          ) AS "overtimeMinutes",
          (SELECT COUNT(*)::int FROM frequent_late) AS "frequentLateEmployees",
          (SELECT anomaly_count::int FROM anomaly_summary) AS "anomalyCount"
      `,
      [companyId],
    );

    return mapAttendanceSummary(result.rows[0]);
  },

  async listLiveActivity(companyId: string) {
    const result = await query<ActivityRow>(
      `
        SELECT
          attendance_records.id,
          users.full_name AS "employeeName",
          users.email AS "employeeEmail",
          CASE
            WHEN attendance_records.check_out_at IS NULL THEN 'Checked in'
            ELSE 'Checked out'
          END AS action,
          COALESCE(attendance_records.check_out_at, attendance_records.check_in_at) AS "occurredAt"
        FROM attendance_records
        INNER JOIN users
          ON users.id = attendance_records.user_id
        WHERE attendance_records.company_id = $1
          AND attendance_records.attendance_date = CURRENT_DATE
          AND users.is_active = TRUE
          AND users.role NOT IN ('superadmin', 'admin')
        ORDER BY COALESCE(attendance_records.check_out_at, attendance_records.check_in_at) DESC
        LIMIT 5
      `,
      [companyId],
    );

    return result.rows.map((row) => mapActivity(row));
  },

  async getPendingActionCounts(companyId: string): Promise<AdminPendingActionCounts> {
    const result = await query<PendingActionCountsRow>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM leave_requests
            WHERE company_id = $1
              AND status = 'pending'
          ) AS "leaveRequests",
          (
            SELECT COUNT(*)::int
            FROM attendance_corrections
            WHERE company_id = $1
              AND status = 'pending'
          ) AS "attendanceCorrections",
          0::int AS "documentApprovals",
          (
            SELECT COUNT(*)::int
            FROM payroll_runs
            WHERE company_id = $1
              AND status = 'draft'
          ) AS "salaryApprovals",
          (
            SELECT COUNT(*)::int
            FROM offboarding_requests
            WHERE company_id = $1
              AND status = 'pending'
          ) AS "resignationRequests"
      `,
      [companyId],
    );

    const row = result.rows[0];

    return {
      leaveRequests: toNumber(row?.leaveRequests),
      attendanceCorrections: toNumber(row?.attendanceCorrections),
      documentApprovals: toNumber(row?.documentApprovals),
      salaryApprovals: toNumber(row?.salaryApprovals),
      resignationRequests: toNumber(row?.resignationRequests),
    };
  },

  async listLatestAnnouncements(companyId: string) {
    const result = await query<AnnouncementRow>(
      `
        SELECT
          announcements.id,
          announcements.title,
          announcements.content,
          announcements.priority,
          announcements.published_at AS "publishedAt",
          announcements.created_at AS "createdAt",
          creator.full_name AS "postedBy"
        FROM announcements
        LEFT JOIN users AS creator
          ON creator.id = announcements.created_by
        WHERE announcements.company_id = $1
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        ORDER BY
          announcements.is_pinned DESC,
          COALESCE(announcements.published_at, announcements.created_at) DESC,
          announcements.created_at DESC
        LIMIT 3
      `,
      [companyId],
    );

    return result.rows.map((row) => mapAnnouncement(row));
  },

  async findPrimaryOffice(companyId: string) {
    const result = await query<OfficeRow>(
      `
        SELECT
          id,
          name,
          city,
          state,
          country,
          is_primary AS "isPrimary"
        FROM office_locations
        WHERE company_id = $1
          AND is_active = TRUE
        ORDER BY is_primary DESC, name ASC, created_at ASC
        LIMIT 1
      `,
      [companyId],
    );

    return mapOffice(result.rows[0]);
  },

  async getCompanySnapshotCounts(
    companyId: string,
  ): Promise<AdminCompanySnapshotCounts> {
    const result = await query<SnapshotCountsRow>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM office_locations
            WHERE company_id = $1
              AND is_active = TRUE
          ) AS "totalOffices",
          (
            SELECT COUNT(*)::int
            FROM departments
            WHERE company_id = $1
          ) AS "departments"
      `,
      [companyId],
    );
    const row = result.rows[0];

    return {
      totalOffices: toNumber(row?.totalOffices),
      departments: toNumber(row?.departments),
    };
  },

  async getSystemHealth(companyId: string) {
    const result = await query<SystemHealthRow>(
      `
        SELECT
          (
            SELECT COALESCE(SUM(COALESCE(documents.size_bytes, 0)), 0)::bigint
            FROM documents
            WHERE documents.company_id = $1
              AND documents.deleted_at IS NULL
          ) AS "usedBytes",
          companies.document_storage_quota_bytes AS "quotaBytes",
          notification_settings.email_notifications AS "emailNotifications",
          (
            SELECT MAX(notifications.created_at)
            FROM notifications
            WHERE notifications.company_id = $1
              AND notifications.type = 'backup.completed'
          ) AS "lastBackupAt"
        FROM companies
        LEFT JOIN company_notification_settings AS notification_settings
          ON notification_settings.company_id = companies.id
        WHERE companies.id = $1
        LIMIT 1
      `,
      [companyId],
    );

    return mapSystemHealth(result.rows[0]);
  },
};
