import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { usersRepository } from "../users/users.repository.js";
import { auditRepository } from "./audit.repository.js";
import type {
  AuditActorSummary,
  AuditLogFilters,
  AuditServiceResult,
  AuditWorkspaceResponse,
  CreateAuditLogInput,
} from "./audit.types.js";

function ok<T>(data: T): AuditServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(status: 403 | 404, message: string): AuditServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function buildActorSummary(
  actor: Pick<AuthenticatedUser, "id" | "fullName" | "email" | "role">,
): AuditActorSummary {
  return {
    id: actor.id,
    fullName: actor.fullName,
    email: actor.email.toLowerCase(),
    role: actor.role,
  };
}

function normalizeFilterValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

async function buildWorkspace(
  user: AuthenticatedUser,
  filters: AuditLogFilters,
): Promise<AuditWorkspaceResponse | null> {
  if (!user.companyId) {
    return null;
  }

  const [company, totalLogs, filteredLogs, logs, currentUsers, historicalActors, actions, entityTypes] =
    await Promise.all([
      companiesService.getCompanyView(user.companyId),
      auditRepository.countCompanyAuditLogs(user.companyId),
      auditRepository.countAuditLogs(user.companyId, filters),
      auditRepository.listAuditLogs(user.companyId, filters),
      usersRepository.listCompanyUserProfiles(user.companyId),
      auditRepository.listAuditActors(user.companyId),
      auditRepository.listAuditActions(user.companyId),
      auditRepository.listAuditEntityTypes(user.companyId),
    ]);

  if (!company) {
    return null;
  }

  const availableUsersById = new Map<string, AuditActorSummary>();

  for (const profile of currentUsers) {
    availableUsersById.set(profile.id, {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email.toLowerCase(),
      role: profile.role,
    });
  }

  for (const actor of historicalActors) {
    if (!availableUsersById.has(actor.id)) {
      availableUsersById.set(actor.id, actor);
    }
  }

  const availableUsers = [...availableUsersById.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName),
  );

  return {
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
    },
    summary: {
      totalLogs,
      filteredLogs,
      uniqueActors: availableUsers.length,
      uniqueEntityTypes: entityTypes.length,
    },
    activeFilters: {
      userId: filters.userId ?? null,
      action: filters.action ?? null,
      entityType: filters.entityType ?? null,
    },
    availableUsers,
    availableActions: actions,
    availableEntityTypes: entityTypes,
    logs,
  };
}

export const auditService = {
  async getWorkspace(
    user: AuthenticatedUser,
    filters: AuditLogFilters = {},
  ): Promise<AuditServiceResult<AuditWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const workspace = await buildWorkspace(user, {
      userId: normalizeFilterValue(filters.userId),
      action: normalizeFilterValue(filters.action),
      entityType: normalizeFilterValue(filters.entityType),
    });

    if (!workspace) {
      return fail(404, "Company not found.");
    }

    return ok(workspace);
  },

  async recordAction(
    actor: Pick<AuthenticatedUser, "id" | "fullName" | "email" | "role" | "companyId">,
    input: Omit<CreateAuditLogInput, "companyId" | "userId" | "metadata"> & {
      companyId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const companyId = input.companyId ?? actor.companyId ?? null;
    const action = input.action.trim();
    const entityType = input.entityType.trim();

    if (!action || !entityType) {
      return;
    }

    try {
      await auditRepository.createAuditLog({
        companyId,
        userId: actor.id,
        action,
        entityType,
        entityId: input.entityId ?? null,
        metadata: {
          ...(input.metadata ?? {}),
          actor: buildActorSummary(actor),
        },
      });
    } catch (error) {
      console.warn("Failed to persist audit log.", {
        companyId,
        userId: actor.id,
        action,
        entityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
