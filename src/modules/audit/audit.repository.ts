import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import type {
  AuditActorSummary,
  AuditLogFilters,
  AuditLogRecord,
  CreateAuditLogInput,
} from "./audit.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type AuditLogRow = {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  actorId: string;
  actorFullName: string;
  actorEmail: string;
  actorRole: string;
  createdAt: Date | string;
};

type GlobalAuditLogRow = {
  id: string;
  companyId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date | string;
  actorId: string | null;
  actorFullName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  companyName: string | null;
  companyCode: string | null;
};

type AuditSummaryRow = {
  count: number | string;
};

type AuditActorRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

type AuditTextRow = {
  value: string;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function extractActorSnapshot(metadata: Record<string, unknown>) {
  const actor = metadata.actor;

  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    return null;
  }

  const actorRecord = actor as Record<string, unknown>;
  const id = typeof actorRecord.id === "string" ? actorRecord.id.trim() : "";
  const fullName =
    typeof actorRecord.fullName === "string" ? actorRecord.fullName.trim() : "";
  const email = typeof actorRecord.email === "string" ? actorRecord.email.trim() : "";
  const role = typeof actorRecord.role === "string" ? actorRecord.role.trim() : "";

  if (!id || !fullName || !email || !role) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    role,
  } satisfies AuditActorSummary;
}

function mapAuditLogRow(row: AuditLogRow): AuditLogRecord {
  const metadata = normalizeMetadata(row.metadata);
  const snapshot = extractActorSnapshot(metadata);

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    actor: {
      id: row.actorId || snapshot?.id || row.userId,
      fullName: row.actorFullName || snapshot?.fullName || row.userId,
      email: row.actorEmail || snapshot?.email || "",
      role: row.actorRole || snapshot?.role || "unknown",
    },
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata,
    createdAt: toIsoString(row.createdAt),
  };
}

function mapGlobalAuditLogRow(row: GlobalAuditLogRow) {
  const metadata = normalizeMetadata(row.metadata);
  const snapshot = extractActorSnapshot(metadata);

  return {
    id: row.id,
    company: row.companyId
      ? {
          id: row.companyId,
          name: row.companyName ?? row.companyId,
          code: row.companyCode ?? "",
        }
      : null,
    actor:
      row.actorId || snapshot
        ? {
            id: row.actorId ?? snapshot?.id ?? "",
            fullName: row.actorFullName ?? snapshot?.fullName ?? "Unknown Actor",
            email: row.actorEmail ?? snapshot?.email ?? "",
            role: row.actorRole ?? snapshot?.role ?? "unknown",
          }
        : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata,
    createdAt: toIsoString(row.createdAt),
  };
}

function buildCompanyFilterConditions(filters: AuditLogFilters) {
  const conditions: string[] = [];
  const params: Array<string | null> = [];

  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`audit_logs.actor_user_id = $${params.length + 1}`);
  }

  if (filters.action) {
    params.push(filters.action);
    conditions.push(`LOWER(audit_logs.action) = LOWER($${params.length + 1})`);
  }

  if (filters.entityType) {
    params.push(filters.entityType);
    conditions.push(`LOWER(audit_logs.entity_type) = LOWER($${params.length + 1})`);
  }

  return {
    conditions,
    params,
  };
}

function buildCompanyWhereClause(conditions: readonly string[]) {
  if (conditions.length === 0) {
    return "audit_logs.company_id = $1";
  }

  return `audit_logs.company_id = $1 AND ${conditions.join(" AND ")}`;
}

function buildGlobalFilterConditions(filters: {
  companyId?: string | null;
  action?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const conditions: string[] = [];
  const params: Array<string | null> = [];

  if (filters.companyId) {
    params.push(filters.companyId);
    conditions.push(`audit_logs.company_id = $${params.length}`);
  }

  if (filters.action) {
    params.push(filters.action);
    conditions.push(`LOWER(audit_logs.action) = LOWER($${params.length})`);
  }

  if (filters.dateFrom) {
    params.push(`${filters.dateFrom}T00:00:00.000Z`);
    conditions.push(`audit_logs.created_at >= $${params.length}::timestamptz`);
  }

  if (filters.dateTo) {
    params.push(`${filters.dateTo}T23:59:59.999Z`);
    conditions.push(`audit_logs.created_at <= $${params.length}::timestamptz`);
  }

  return {
    conditions,
    params,
  };
}

function buildGlobalWhereClause(conditions: readonly string[]) {
  return conditions.length > 0 ? conditions.join(" AND ") : "TRUE";
}

export const auditRepository = {
  async createAuditLog(
    input: CreateAuditLogInput,
    executor?: DatabaseExecutor,
  ): Promise<string | null> {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO audit_logs (
          id,
          company_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb), NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.userId,
        input.action.trim(),
        input.entityType.trim(),
        input.entityId ?? null,
        input.metadata ?? {},
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async countCompanyAuditLogs(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditSummaryRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE company_id = $1
      `,
      [companyId],
    );

    return Number(result.rows[0]?.count ?? 0);
  },

  async countAuditLogs(
    companyId: string,
    filters: AuditLogFilters = {},
    executor?: DatabaseExecutor,
  ) {
    const { conditions, params } = buildCompanyFilterConditions(filters);

    const result = await resolveExecutor(executor).query<AuditSummaryRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE ${buildCompanyWhereClause(conditions)}
      `,
      [companyId, ...params],
    );

    return Number(result.rows[0]?.count ?? 0);
  },

  async listAuditLogs(
    companyId: string,
    filters: AuditLogFilters = {},
    executor?: DatabaseExecutor,
  ) {
    const { conditions, params } = buildCompanyFilterConditions(filters);

    const result = await resolveExecutor(executor).query<AuditLogRow>(
      `
        SELECT
          audit_logs.id,
          audit_logs.company_id AS "companyId",
          audit_logs.actor_user_id AS "userId",
          audit_logs.action,
          audit_logs.entity_type AS "entityType",
          audit_logs.entity_id AS "entityId",
          audit_logs.metadata,
          COALESCE(actor.id, audit_logs.actor_user_id) AS "actorId",
          COALESCE(actor.full_name, audit_logs.metadata->'actor'->>'fullName', audit_logs.actor_user_id) AS "actorFullName",
          COALESCE(actor.email, audit_logs.metadata->'actor'->>'email', '') AS "actorEmail",
          COALESCE(actor.role, audit_logs.metadata->'actor'->>'role', 'unknown') AS "actorRole",
          audit_logs.created_at AS "createdAt"
        FROM audit_logs
        LEFT JOIN users AS actor
          ON actor.id = audit_logs.actor_user_id
        WHERE ${buildCompanyWhereClause(conditions)}
        ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
        LIMIT 250
      `,
      [companyId, ...params],
    );

    return result.rows.map((row) => mapAuditLogRow(row));
  },

  async listAuditActors(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditActorRow>(
      `
        SELECT DISTINCT ON (audit_logs.actor_user_id)
          COALESCE(actor.id, audit_logs.actor_user_id) AS "id",
          COALESCE(actor.full_name, audit_logs.metadata->'actor'->>'fullName', audit_logs.actor_user_id) AS "fullName",
          COALESCE(actor.email, audit_logs.metadata->'actor'->>'email', '') AS "email",
          COALESCE(actor.role, audit_logs.metadata->'actor'->>'role', 'unknown') AS "role"
        FROM audit_logs
        LEFT JOIN users AS actor
          ON actor.id = audit_logs.actor_user_id
        WHERE audit_logs.company_id = $1
          AND audit_logs.actor_user_id IS NOT NULL
        ORDER BY audit_logs.actor_user_id ASC, audit_logs.created_at DESC, audit_logs.id DESC
      `,
      [companyId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      role: row.role,
    })) satisfies AuditActorSummary[];
  },

  async listAuditActions(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditTextRow>(
      `
        SELECT DISTINCT audit_logs.action AS value
        FROM audit_logs
        WHERE audit_logs.company_id = $1
        ORDER BY value ASC
      `,
      [companyId],
    );

    return result.rows.map((row) => row.value);
  },

  async listAuditEntityTypes(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditTextRow>(
      `
        SELECT DISTINCT audit_logs.entity_type AS value
        FROM audit_logs
        WHERE audit_logs.company_id = $1
        ORDER BY value ASC
      `,
      [companyId],
    );

    return result.rows.map((row) => row.value);
  },

  async countAllAuditLogs(executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditSummaryRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
      `,
    );

    return Number(result.rows[0]?.count ?? 0);
  },

  async countGlobalAuditLogs(
    filters: {
      companyId?: string | null;
      action?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    } = {},
    executor?: DatabaseExecutor,
  ) {
    const { conditions, params } = buildGlobalFilterConditions(filters);
    const result = await resolveExecutor(executor).query<AuditSummaryRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE ${buildGlobalWhereClause(conditions)}
      `,
      params,
    );

    return Number(result.rows[0]?.count ?? 0);
  },

  async listGlobalAuditLogs(
    filters: {
      companyId?: string | null;
      action?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    } = {},
    pagination: {
      page: number;
      pageSize: number;
    },
    executor?: DatabaseExecutor,
  ) {
    const { conditions, params } = buildGlobalFilterConditions(filters);
    const offset = Math.max(pagination.page - 1, 0) * pagination.pageSize;

    const result = await resolveExecutor(executor).query<GlobalAuditLogRow>(
      `
        SELECT
          audit_logs.id,
          audit_logs.company_id AS "companyId",
          audit_logs.action,
          audit_logs.entity_type AS "entityType",
          audit_logs.entity_id AS "entityId",
          audit_logs.metadata,
          audit_logs.created_at AS "createdAt",
          actor.id AS "actorId",
          COALESCE(actor.full_name, audit_logs.metadata->'actor'->>'fullName') AS "actorFullName",
          COALESCE(actor.email, audit_logs.metadata->'actor'->>'email') AS "actorEmail",
          COALESCE(actor.role, audit_logs.metadata->'actor'->>'role') AS "actorRole",
          companies.name AS "companyName",
          companies.code AS "companyCode"
        FROM audit_logs
        LEFT JOIN users AS actor
          ON actor.id = audit_logs.actor_user_id
        LEFT JOIN companies
          ON companies.id = audit_logs.company_id
        WHERE ${buildGlobalWhereClause(conditions)}
        ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, pagination.pageSize, offset],
    );

    return result.rows.map((row) => mapGlobalAuditLogRow(row));
  },

  async listGlobalAuditActions(executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<AuditTextRow>(
      `
        SELECT DISTINCT audit_logs.action AS value
        FROM audit_logs
        ORDER BY value ASC
      `,
    );

    return result.rows.map((row) => row.value);
  },

  async listRecentAuditLogs(limit: number, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<GlobalAuditLogRow>(
      `
        SELECT
          audit_logs.id,
          audit_logs.company_id AS "companyId",
          audit_logs.action,
          audit_logs.entity_type AS "entityType",
          audit_logs.entity_id AS "entityId",
          audit_logs.metadata,
          audit_logs.created_at AS "createdAt",
          actor.id AS "actorId",
          COALESCE(actor.full_name, audit_logs.metadata->'actor'->>'fullName') AS "actorFullName",
          COALESCE(actor.email, audit_logs.metadata->'actor'->>'email') AS "actorEmail",
          COALESCE(actor.role, audit_logs.metadata->'actor'->>'role') AS "actorRole",
          companies.name AS "companyName",
          companies.code AS "companyCode"
        FROM audit_logs
        LEFT JOIN users AS actor
          ON actor.id = audit_logs.actor_user_id
        LEFT JOIN companies
          ON companies.id = audit_logs.company_id
        ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map((row) => mapGlobalAuditLogRow(row));
  },
};
