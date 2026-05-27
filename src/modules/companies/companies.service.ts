import { auditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import {
  companiesRepository,
  type CompanyDeleteBlocker,
} from "./companies.repository.js";
import {
  normalizeCompanyModules,
  type AssignCompanyAdminRequest,
  type CompaniesServiceResult,
  type CompaniesWorkspaceResponse,
  type CompanyAdminCandidate,
  type CompanyDependencySummaryItem,
  type CompanyDeleteResponse,
  type CompanyDetailResponse,
  type CompanyMutationResponse,
  type CompanyRecord,
  type CompanyView,
  type CreateCompanyRequest,
  type UpdateCompanyLogoRequest,
  type UpdateCompanyModulesRequest,
  type UpdateCompanyRequest,
  type UpdateCompanyStatusRequest,
} from "./companies.types.js";

function ok<T>(data: T): CompaniesServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 404 | 409,
  message: string,
): CompaniesServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function formatDeleteBlockers(blockers: readonly CompanyDeleteBlocker[]) {
  return blockers
    .map((blocker) => `${blocker.count} ${blocker.label}`)
    .join(", ");
}

function summarizeDependencies(
  dependencySummary: readonly CompanyDependencySummaryItem[],
) {
  return dependencySummary.filter((entry) => entry.count > 0);
}

async function buildAdminLookup(records: readonly CompanyRecord[]) {
  const adminIds = records
    .map((record) => record.assignedAdminUserId)
    .filter((adminUserId): adminUserId is string => Boolean(adminUserId));

  return companiesRepository.listAdminsByIds(adminIds);
}

function toCompanyView(
  record: CompanyRecord,
  adminLookup: Map<string, CompanyAdminCandidate>,
): CompanyView {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    industry: record.industry,
    contactEmail: record.contactEmail,
    logoUrl: record.logoUrl,
    status: record.status,
    onboardingStatus: record.onboardingStatus,
    archivedAt: record.archivedAt,
    admin: record.assignedAdminUserId
      ? adminLookup.get(record.assignedAdminUserId) ?? null
      : null,
    enabledModules: [...record.enabledModules],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function recordCompanyAudit(
  actor: AuthenticatedUser | undefined,
  input: {
    companyId: string | null;
    action: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!actor) {
    return;
  }

  void auditService.recordAction(actor, {
    companyId: input.companyId,
    action: input.action,
    entityType: "company",
    entityId: input.entityId,
    metadata: input.metadata,
  });
}

export const companiesService = {
  async listCompanies() {
    const records = await companiesRepository.listCompanies();
    const adminLookup = await buildAdminLookup(records);

    return records.map((record) => toCompanyView(record, adminLookup));
  },

  async getCompanyView(companyId: string): Promise<CompanyView | null> {
    const company = await companiesRepository.findCompanyById(companyId);

    if (!company) {
      return null;
    }

    const adminLookup = await buildAdminLookup([company]);

    return toCompanyView(company, adminLookup);
  },

  async listAvailableAdmins() {
    return companiesRepository.listAvailableAdmins();
  },

  listAvailableModules() {
    return companiesRepository.listAvailableModules();
  },

  async getCompaniesWorkspace(): Promise<CompaniesWorkspaceResponse> {
    const [items, availableAdmins] = await Promise.all([
      this.listCompanies(),
      this.listAvailableAdmins(),
    ]);

    return {
      items,
      availableAdmins,
      availableModules: this.listAvailableModules(),
    };
  },

  async getCompanyDetail(
    companyId: string,
  ): Promise<CompaniesServiceResult<CompanyDetailResponse>> {
    const [company, availableAdmins, dependencySummary] = await Promise.all([
      this.getCompanyView(companyId),
      this.listAvailableAdmins(),
      companiesRepository.listCompanyDependencySummary(companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company,
      availableAdmins,
      availableModules: this.listAvailableModules(),
      dependencySummary,
    });
  },

  async createCompany(
    input: CreateCompanyRequest,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyByCode(input.code);

    if (existingCompany) {
      return fail(409, "A company with this code already exists.");
    }

    try {
      const company = await companiesRepository.createCompany(input);

      if (!company) {
        return fail(404, "Company not found.");
      }

      const adminLookup = await buildAdminLookup([company]);

      return ok({
        message: "Company created successfully.",
        company: toCompanyView(company, adminLookup),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A company with this code already exists.");
      }

      throw error;
    }
  },

  async updateCompany(
    companyId: string,
    input: UpdateCompanyRequest,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    const companyWithCode = await companiesRepository.findCompanyByCode(input.code);

    if (companyWithCode && companyWithCode.id !== companyId) {
      return fail(409, "A company with this code already exists.");
    }

    try {
      const updatedCompany = await companiesRepository.updateCompany(companyId, input);

      if (!updatedCompany) {
        return fail(404, "Company not found.");
      }

      const adminLookup = await buildAdminLookup([updatedCompany]);

      return ok({
        message: "Company details updated successfully.",
        company: toCompanyView(updatedCompany, adminLookup),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A company with this code already exists.");
      }

      throw error;
    }
  },

  async updateCompanyStatus(
    companyId: string,
    input: UpdateCompanyStatusRequest,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    if (existingCompany.archivedAt) {
      return fail(409, "Restore the company before changing its active status.");
    }

    const company = await companiesRepository.updateCompanyStatus(
      companyId,
      input.status,
    );

    if (!company) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([company]);

    return ok({
      message:
        input.status === "active"
          ? "Company activated successfully."
          : "Company deactivated successfully.",
      company: toCompanyView(company, adminLookup),
    });
  },

  async archiveCompany(
    companyId: string,
    actor?: AuthenticatedUser,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    if (existingCompany.archivedAt) {
      return fail(409, "This company is already archived.");
    }

    const archivedCompany = await companiesRepository.archiveCompany(companyId);

    if (!archivedCompany) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([archivedCompany]);
    const companyView = toCompanyView(archivedCompany, adminLookup);

    recordCompanyAudit(actor, {
      companyId: archivedCompany.id,
      action: "company_archived",
      entityId: archivedCompany.id,
      metadata: {
        previousState: {
          status: existingCompany.status,
          onboardingStatus: existingCompany.onboardingStatus,
          archivedAt: existingCompany.archivedAt,
        },
        nextState: {
          status: archivedCompany.status,
          onboardingStatus: archivedCompany.onboardingStatus,
          archivedAt: archivedCompany.archivedAt,
        },
      },
    });

    return ok({
      message: "Company archived successfully.",
      company: companyView,
    });
  },

  async restoreCompany(
    companyId: string,
    actor?: AuthenticatedUser,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    if (!existingCompany.archivedAt) {
      return fail(409, "This company is not archived.");
    }

    const restoredCompany = await companiesRepository.restoreCompany(companyId);

    if (!restoredCompany) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([restoredCompany]);
    const companyView = toCompanyView(restoredCompany, adminLookup);

    recordCompanyAudit(actor, {
      companyId: restoredCompany.id,
      action: "company_restored",
      entityId: restoredCompany.id,
      metadata: {
        previousState: {
          status: existingCompany.status,
          onboardingStatus: existingCompany.onboardingStatus,
          archivedAt: existingCompany.archivedAt,
        },
        nextState: {
          status: restoredCompany.status,
          onboardingStatus: restoredCompany.onboardingStatus,
          archivedAt: restoredCompany.archivedAt,
        },
      },
    });

    return ok({
      message: "Company restored successfully.",
      company: companyView,
    });
  },

  async updateCompanyLogo(
    companyId: string,
    input: UpdateCompanyLogoRequest,
    actor?: AuthenticatedUser,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    const updatedCompany = await companiesRepository.updateCompanyLogo(
      companyId,
      input.logoUrl,
    );

    if (!updatedCompany) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([updatedCompany]);
    const companyView = toCompanyView(updatedCompany, adminLookup);

    recordCompanyAudit(actor, {
      companyId: updatedCompany.id,
      action: "company_logo_updated",
      entityId: updatedCompany.id,
      metadata: {
        previousLogoUrl: existingCompany.logoUrl,
        nextLogoUrl: updatedCompany.logoUrl,
      },
    });

    return ok({
      message: input.logoUrl
        ? "Company logo updated successfully."
        : "Company logo removed successfully.",
      company: companyView,
    });
  },

  async deleteCompany(
    companyId: string,
    actor?: AuthenticatedUser,
  ): Promise<CompaniesServiceResult<CompanyDeleteResponse>> {
    const existingCompany = await companiesRepository.findCompanyById(companyId);

    if (!existingCompany) {
      return fail(404, "Company not found.");
    }

    if (!existingCompany.archivedAt) {
      return fail(409, "Archive the company before deleting it permanently.");
    }

    const blockers = summarizeDependencies(
      await companiesRepository.listCompanyDependencySummary(companyId),
    );

    if (blockers.length > 0) {
      return fail(
        409,
        `Delete blocked. Remove linked records first: ${formatDeleteBlockers(blockers)}.`,
      );
    }

    const deletedCompanyId = await companiesRepository.deleteCompany(companyId);

    if (!deletedCompanyId) {
      return fail(404, "Company not found.");
    }

    recordCompanyAudit(actor, {
      companyId: null,
      action: "company_deleted",
      entityId: deletedCompanyId,
      metadata: {
        companyId: deletedCompanyId,
        company: {
          id: existingCompany.id,
          name: existingCompany.name,
          code: existingCompany.code,
          status: existingCompany.status,
          onboardingStatus: existingCompany.onboardingStatus,
          archivedAt: existingCompany.archivedAt,
        },
      },
    });

    return ok({
      message: "Company deleted successfully.",
      deletedCompanyId,
    });
  },

  async assignCompanyAdmin(
    companyId: string,
    input: AssignCompanyAdminRequest,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const company = await companiesRepository.findCompanyById(companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const admin = await companiesRepository.findAdminById(input.adminUserId);

    if (!admin) {
      return fail(404, "Company admin candidate not found.");
    }

    const updatedCompany = await companiesRepository.assignCompanyAdmin(
      companyId,
      input.adminUserId,
    );

    if (!updatedCompany) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([updatedCompany]);

    return ok({
      message: "Company admin assigned successfully.",
      company: toCompanyView(updatedCompany, adminLookup),
    });
  },

  async updateCompanyModules(
    companyId: string,
    input: UpdateCompanyModulesRequest,
  ): Promise<CompaniesServiceResult<CompanyMutationResponse>> {
    const company = await companiesRepository.findCompanyById(companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const enabledModules = normalizeCompanyModules(input.enabledModules);
    const updatedCompany = await companiesRepository.updateCompanyModules(
      companyId,
      enabledModules,
    );

    if (!updatedCompany) {
      return fail(404, "Company not found.");
    }

    const adminLookup = await buildAdminLookup([updatedCompany]);

    return ok({
      message: "Company module visibility updated successfully.",
      company: toCompanyView(updatedCompany, adminLookup),
    });
  },
};
