import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import {
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementCategory,
  type AnnouncementCreatorSummary,
  type AnnouncementManagementRecord,
  type AnnouncementPriority,
  type AnnouncementRecord,
  type AnnouncementStatus,
} from "./announcements.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type AnnouncementRow = {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  isPinned: boolean;
  seenAt?: Date | string | null;
  acknowledgedAt?: Date | string | null;
  isImportantForUser?: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ManagementAnnouncementRow = AnnouncementRow & {
  createdById: string | null;
  createdByFullName: string | null;
  createdByEmail: string | null;
  createdByProfilePhotoUrl: string | null;
  audienceTotal: number | string;
  seenCount: number | string;
  acknowledgedCount: number | string;
};

type AnnouncementCategorySummaryRow = {
  category: AnnouncementCategory;
  count: number;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function buildSummary(content: string, maxLength = 180) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function isNewAnnouncement(publishedAt: string) {
  const publishedTime = new Date(publishedAt).getTime();

  if (Number.isNaN(publishedTime)) {
    return false;
  }

  return Date.now() - publishedTime <= 7 * 24 * 60 * 60 * 1000;
}

function mapAnnouncementRow(row: AnnouncementRow | undefined): AnnouncementRecord | null {
  if (!row) {
    return null;
  }

  const publishedAt = row.publishedAt
    ? toIsoString(row.publishedAt)
    : toIsoString(row.createdAt);

  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    content: row.content,
    summary: buildSummary(row.content),
    category: row.category,
    priority: row.priority,
    status: row.status,
    isPinned: row.isPinned,
    isNew: isNewAnnouncement(publishedAt),
    seenAt: row.seenAt ? toIsoString(row.seenAt) : null,
    acknowledgedAt: row.acknowledgedAt ? toIsoString(row.acknowledgedAt) : null,
    isImportantForUser: row.isImportantForUser ?? false,
    publishedAt,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function toCount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function mapAnnouncementCreator(row: ManagementAnnouncementRow): AnnouncementCreatorSummary | null {
  if (!row.createdById || !row.createdByFullName || !row.createdByEmail) {
    return null;
  }

  return {
    id: row.createdById,
    fullName: row.createdByFullName,
    email: row.createdByEmail,
    profilePhotoUrl: row.createdByProfilePhotoUrl ?? null,
  };
}

function mapManagementAnnouncementRow(
  row: ManagementAnnouncementRow | undefined,
): AnnouncementManagementRecord | null {
  if (!row) {
    return null;
  }

  const announcement = mapAnnouncementRow(row);

  if (!announcement) {
    return null;
  }

  return {
    ...announcement,
    createdBy: mapAnnouncementCreator(row),
    audienceTotal: toCount(row.audienceTotal),
    seenCount: toCount(row.seenCount),
    acknowledgedCount: toCount(row.acknowledgedCount),
  };
}

const announcementSelect = `
  SELECT
    announcements.id,
    announcements.company_id AS "companyId",
    announcements.title,
    announcements.content,
    announcements.category,
    announcements.priority,
    announcements.status,
    announcements.is_pinned AS "isPinned",
    announcements.published_at AS "publishedAt",
    announcements.created_at AS "createdAt",
    announcements.updated_at AS "updatedAt"
  FROM announcements
`;

const employeeAnnouncementSelect = `
  SELECT
    announcements.id,
    announcements.company_id AS "companyId",
    announcements.title,
    announcements.content,
    announcements.category,
    announcements.priority,
    announcements.status,
    announcements.is_pinned AS "isPinned",
    announcement_user_states.seen_at AS "seenAt",
    announcement_user_states.acknowledged_at AS "acknowledgedAt",
    COALESCE(announcement_user_states.is_important, FALSE) AS "isImportantForUser",
    announcements.published_at AS "publishedAt",
    announcements.created_at AS "createdAt",
    announcements.updated_at AS "updatedAt"
  FROM announcements
  LEFT JOIN announcement_user_states
    ON announcement_user_states.company_id = announcements.company_id
   AND announcement_user_states.announcement_id = announcements.id
   AND announcement_user_states.user_id = $2
`;

const managementAnnouncementSelect = `
  SELECT
    announcements.id,
    announcements.company_id AS "companyId",
    announcements.title,
    announcements.content,
    announcements.category,
    announcements.priority,
    announcements.status,
    announcements.is_pinned AS "isPinned",
    announcements.published_at AS "publishedAt",
    announcements.created_at AS "createdAt",
    announcements.updated_at AS "updatedAt",
    creator.id AS "createdById",
    creator.full_name AS "createdByFullName",
    creator.email AS "createdByEmail",
    creator.profile_photo_url AS "createdByProfilePhotoUrl",
    COALESCE(audience.total, 0)::int AS "audienceTotal",
    COALESCE(engagement.seen_count, 0)::int AS "seenCount",
    COALESCE(engagement.acknowledged_count, 0)::int AS "acknowledgedCount"
  FROM announcements
  LEFT JOIN users creator
    ON creator.id = announcements.created_by
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE users.is_active = TRUE AND users.role <> 'superadmin') AS total
    FROM users
    WHERE users.company_id = announcements.company_id
  ) audience ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE announcement_user_states.seen_at IS NOT NULL) AS seen_count,
      COUNT(*) FILTER (WHERE announcement_user_states.acknowledged_at IS NOT NULL) AS acknowledged_count
    FROM announcement_user_states
    WHERE announcement_user_states.company_id = announcements.company_id
      AND announcement_user_states.announcement_id = announcements.id
  ) engagement ON TRUE
`;

export const announcementsRepository = {
  async listEmployeeAnnouncements(
    companyId: string,
    userId: string,
    options: {
      limit?: number;
    } = {},
    executor?: DatabaseExecutor,
  ) {
    const safeLimit =
      typeof options.limit === "number" && Number.isInteger(options.limit) && options.limit > 0
        ? options.limit
        : null;

    const limitSql = safeLimit ? `LIMIT ${safeLimit}` : "";
    const result = await resolveExecutor(executor).query<AnnouncementRow>(
      `
        ${employeeAnnouncementSelect}
        WHERE announcements.company_id = $1
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        ORDER BY
          announcements.is_pinned DESC,
          COALESCE(announcements.published_at, announcements.created_at) DESC,
          announcements.created_at DESC
        ${limitSql}
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapAnnouncementRow(row))
      .filter((row): row is AnnouncementRecord => row !== null);
  },

  async listEmployeeAnnouncementCategorySummary(
    companyId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AnnouncementCategorySummaryRow>(
      `
        SELECT
          announcements.category,
          COUNT(*)::int AS count
        FROM announcements
        WHERE announcements.company_id = $1
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        GROUP BY announcements.category
      `,
      [companyId],
    );

    const countsByCategory = new Map<AnnouncementCategory, number>();

    result.rows.forEach((row) => {
      countsByCategory.set(row.category, row.count);
    });

    return ANNOUNCEMENT_CATEGORIES.map((category) => ({
      category,
      count: countsByCategory.get(category) ?? 0,
    }));
  },

  async listManagementAnnouncements(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<ManagementAnnouncementRow>(
      `
        ${managementAnnouncementSelect}
        WHERE announcements.company_id = $1
        ORDER BY
          CASE announcements.status
            WHEN 'active' THEN 0
            WHEN 'draft' THEN 1
            ELSE 2
          END,
          announcements.is_pinned DESC,
          COALESCE(announcements.published_at, announcements.created_at) DESC,
          announcements.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapManagementAnnouncementRow(row))
      .filter((row): row is AnnouncementManagementRecord => row !== null);
  },

  async findAnnouncementById(
    companyId: string,
    announcementId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AnnouncementRow>(
      `
        ${announcementSelect}
        WHERE announcements.company_id = $1
          AND announcements.id = $2
        LIMIT 1
      `,
      [companyId, announcementId],
    );

    return mapAnnouncementRow(result.rows[0]);
  },

  async findEmployeeAnnouncementById(
    companyId: string,
    userId: string,
    announcementId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AnnouncementRow>(
      `
        ${employeeAnnouncementSelect}
        WHERE announcements.company_id = $1
          AND announcements.id = $3
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        LIMIT 1
      `,
      [companyId, userId, announcementId],
    );

    return mapAnnouncementRow(result.rows[0]);
  },

  async markEmployeeAnnouncementSeen(
    companyId: string,
    userId: string,
    announcementId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ announcementId: string }>(
      `
        INSERT INTO announcement_user_states (
          id,
          company_id,
          announcement_id,
          user_id,
          seen_at,
          created_at,
          updated_at
        )
        SELECT
          $4,
          announcements.company_id,
          announcements.id,
          $2,
          NOW(),
          NOW(),
          NOW()
        FROM announcements
        WHERE announcements.company_id = $1
          AND announcements.id = $3
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        ON CONFLICT (company_id, announcement_id, user_id)
        DO UPDATE SET
          seen_at = COALESCE(announcement_user_states.seen_at, NOW()),
          updated_at = NOW()
        RETURNING announcement_id AS "announcementId"
      `,
      [companyId, userId, announcementId, randomUUID()],
    );

    return result.rows[0]?.announcementId ?? null;
  },

  async acknowledgeEmployeeAnnouncement(
    companyId: string,
    userId: string,
    announcementId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ announcementId: string }>(
      `
        INSERT INTO announcement_user_states (
          id,
          company_id,
          announcement_id,
          user_id,
          seen_at,
          acknowledged_at,
          created_at,
          updated_at
        )
        SELECT
          $4,
          announcements.company_id,
          announcements.id,
          $2,
          NOW(),
          NOW(),
          NOW(),
          NOW()
        FROM announcements
        WHERE announcements.company_id = $1
          AND announcements.id = $3
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        ON CONFLICT (company_id, announcement_id, user_id)
        DO UPDATE SET
          seen_at = COALESCE(announcement_user_states.seen_at, NOW()),
          acknowledged_at = NOW(),
          updated_at = NOW()
        RETURNING announcement_id AS "announcementId"
      `,
      [companyId, userId, announcementId, randomUUID()],
    );

    return result.rows[0]?.announcementId ?? null;
  },

  async updateEmployeeAnnouncementImportance(
    companyId: string,
    userId: string,
    announcementId: string,
    isImportant: boolean,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ announcementId: string }>(
      `
        INSERT INTO announcement_user_states (
          id,
          company_id,
          announcement_id,
          user_id,
          is_important,
          created_at,
          updated_at
        )
        SELECT
          $5,
          announcements.company_id,
          announcements.id,
          $2,
          $4,
          NOW(),
          NOW()
        FROM announcements
        WHERE announcements.company_id = $1
          AND announcements.id = $3
          AND announcements.status = 'active'
          AND COALESCE(announcements.published_at, announcements.created_at) <= NOW()
        ON CONFLICT (company_id, announcement_id, user_id)
        DO UPDATE SET
          is_important = $4,
          updated_at = NOW()
        RETURNING announcement_id AS "announcementId"
      `,
      [companyId, userId, announcementId, isImportant, randomUUID()],
    );

    return result.rows[0]?.announcementId ?? null;
  },

  async createAnnouncement(
    input: {
      id?: string;
      companyId: string;
      title: string;
      content: string;
      category: AnnouncementCategory;
      priority: AnnouncementPriority;
      status: AnnouncementStatus;
      isPinned: boolean;
      publishedAt: string | null;
      createdBy: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO announcements (
          id,
          company_id,
          title,
          content,
          category,
          priority,
          status,
          is_pinned,
          published_at,
          created_by,
          updated_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $10, NOW(), NOW())
        RETURNING id
      `,
      [
        input.id ?? randomUUID(),
        input.companyId,
        input.title,
        input.content,
        input.category,
        input.priority,
        input.status,
        input.isPinned,
        input.publishedAt,
        input.createdBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateAnnouncement(
    input: {
      companyId: string;
      announcementId: string;
      title?: string;
      content?: string;
      category?: AnnouncementCategory;
      priority?: AnnouncementPriority;
      status?: AnnouncementStatus;
      isPinned?: boolean;
      publishedAt?: string | null;
      updatedBy: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE announcements
        SET
          title = COALESCE($3, title),
          content = COALESCE($4, content),
          category = COALESCE($5, category),
          priority = COALESCE($6, priority),
          status = COALESCE($7, status),
          is_pinned = COALESCE($8, is_pinned),
          published_at = CASE
            WHEN $9::boolean = FALSE THEN published_at
            ELSE $10::timestamptz
          END,
          updated_by = $11,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        input.companyId,
        input.announcementId,
        input.title ?? null,
        input.content ?? null,
        input.category ?? null,
        input.priority ?? null,
        input.status ?? null,
        typeof input.isPinned === "boolean" ? input.isPinned : null,
        Object.prototype.hasOwnProperty.call(input, "publishedAt"),
        input.publishedAt ?? null,
        input.updatedBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },
};
