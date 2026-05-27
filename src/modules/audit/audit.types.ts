import type { CompanyStatus } from "../companies/companies.types.js";

export type AuditActorSummary = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type AuditLogRecord = {
  id: string;
  companyId: string;
  userId: string;
  actor: AuditActorSummary;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogFilters = {
  userId?: string | null;
  action?: string | null;
  entityType?: string | null;
};

export type AuditWorkspaceSummary = {
  totalLogs: number;
  filteredLogs: number;
  uniqueActors: number;
  uniqueEntityTypes: number;
};

export type AuditWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: AuditWorkspaceSummary;
  activeFilters: {
    userId: string | null;
    action: string | null;
    entityType: string | null;
  };
  availableUsers: AuditActorSummary[];
  availableActions: string[];
  availableEntityTypes: string[];
  logs: AuditLogRecord[];
};

export type CreateAuditLogInput = {
  companyId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 403 | 404;
      message: string;
    };
