import { authRepository } from "../auth/auth.repository.js";
import { generateTemporaryPassword, hashPassword } from "../auth/auth.password.js";
import {
  getPasswordPolicy,
  validatePasswordAgainstPolicy,
} from "../auth/password-policy.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditRepository } from "../audit/audit.repository.js";
import { auditService } from "../audit/audit.service.js";
import { companiesRepository } from "../companies/companies.repository.js";
import { companiesService } from "../companies/companies.service.js";
import { normalizeCompanyModules } from "../companies/companies.types.js";
import { usersService } from "../users/users.service.js";
import { superadminRepository } from "./superadmin.repository.js";
import { superadminSettingsRepository } from "./superadmin-settings.repository.js";
import type {
  CreateSuperadminAdminRequest,
  SetSuperadminAdminPasswordRequest,
  SuperadminAdminPasswordResetResponse,
  SuperadminAdminPasswordSetResponse,
  SuperadminAdminDeleteResponse,
  SuperadminAdminMutationResponse,
  SuperadminAdminsWorkspaceResponse,
  SuperadminAuditLogFilters,
  SuperadminAuditLogsResponse,
  SuperadminModulesWorkspaceResponse,
  SuperadminOverviewResponse,
  SuperadminServiceResult,
  SuperadminSettingsMutationResponse,
  SuperadminSettingsResponse,
  UnassignSuperadminAdminRequest,
  UpdateSuperadminAdminRequest,
  UpdateSuperadminSettingsRequest,
} from "./superadmin.types.js";

function ok<T>(data: T): SuperadminServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): SuperadminServiceResult<T> {
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

function isForeignKeyViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}

function isSuperadminUser(
  user: AuthenticatedUser | undefined,
): user is AuthenticatedUser {
  return Boolean(user && user.role === "superadmin");
}

function normalizeFilterValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

async function validateManualPassword<T>(password: string) {
  const { message, violations } = await validatePasswordAgainstPolicy(password);

  if (violations.length === 0) {
    return null;
  }

  return fail<T>(
    400,
    message ?? "Password does not satisfy the active platform security policy.",
  );
}

function flattenSettingsChanges(
  previousValue: unknown,
  nextValue: unknown,
  prefix = "",
): Array<{
  key: string;
  previous: unknown;
  next: unknown;
}> {
  if (Array.isArray(previousValue) || Array.isArray(nextValue)) {
    const previousArray = Array.isArray(previousValue) ? previousValue : [];
    const nextArray = Array.isArray(nextValue) ? nextValue : [];

    return JSON.stringify(previousArray) === JSON.stringify(nextArray)
      ? []
      : [
          {
            key: prefix,
            previous: previousArray,
            next: nextArray,
          },
        ];
  }

  if (
    previousValue &&
    nextValue &&
    typeof previousValue === "object" &&
    typeof nextValue === "object"
  ) {
    const previousRecord = previousValue as Record<string, unknown>;
    const nextRecord = nextValue as Record<string, unknown>;
    const keys = new Set([
      ...Object.keys(previousRecord),
      ...Object.keys(nextRecord),
    ]);

    return [...keys].flatMap((key) =>
      flattenSettingsChanges(
        previousRecord[key],
        nextRecord[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }

  return previousValue === nextValue
    ? []
    : [
        {
          key: prefix,
          previous: previousValue ?? null,
          next: nextValue ?? null,
        },
      ];
}

function normalizeDateOnly(value?: string | null) {
  const normalized = normalizeFilterValue(value);

  if (!normalized) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizePagination(
  page?: number | null,
  pageSize?: number | null,
) {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  const safePageSize =
    Number.isInteger(pageSize) && (pageSize as number) > 0
      ? Math.min(pageSize as number, 100)
      : 20;

  return {
    page: safePage,
    pageSize: safePageSize,
  };
}

function buildModuleUsage(
  companies: Awaited<ReturnType<typeof companiesService.listCompanies>>,
) {
  const availableModules = superadminRepository.listAvailableModules();

  return availableModules.map((moduleDefinition) => ({
    ...moduleDefinition,
    enabledCompanies: companies.filter((company) =>
      company.enabledModules.includes(moduleDefinition.key),
    ).length,
    totalCompanies: companies.length,
  }));
}

function summarizeAdmin(
  admin: Awaited<ReturnType<typeof superadminRepository.findAdminById>>,
) {
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    phone: admin.phone,
    status: admin.status,
    suspendedAt: admin.suspendedAt,
  };
}

export const superadminService = {
  async getOverview(
    user: AuthenticatedUser | undefined,
  ): Promise<SuperadminServiceResult<SuperadminOverviewResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const [companies, counts, recentActivities] = await Promise.all([
      companiesService.listCompanies(),
      superadminRepository.getPlatformCounts(),
      auditRepository.listRecentAuditLogs(8),
    ]);
    const moduleUsage = buildModuleUsage(companies);
    const recentCompanies = [...companies]
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )
      .slice(0, 5);
    const onboardingSummary = companies.reduce(
      (summary, company) => {
        summary[company.onboardingStatus] += 1;
        return summary;
      },
      {
        pending: 0,
        active: 0,
        suspended: 0,
      } as SuperadminOverviewResponse["onboardingSummary"],
    );

    return ok({
      summary: counts,
      onboardingSummary,
      recentCompanies,
      recentActivities,
      moduleUsage,
    });
  },

  async getAdminsWorkspace(
    user: AuthenticatedUser | undefined,
  ): Promise<SuperadminServiceResult<SuperadminAdminsWorkspaceResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const [companies, admins, availableAdmins] = await Promise.all([
      companiesService.listCompanies(),
      superadminRepository.listAdmins(),
      superadminRepository.listAvailableAdmins(),
    ]);

    return ok({
      admins,
      availableAdmins,
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
        onboardingStatus: company.onboardingStatus,
        archivedAt: company.archivedAt,
        admin: company.admin,
      })),
    });
  },

  async getModulesWorkspace(
    user: AuthenticatedUser | undefined,
  ): Promise<SuperadminServiceResult<SuperadminModulesWorkspaceResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const companies = await companiesService.listCompanies();
    const availableModules = superadminRepository.listAvailableModules();

    return ok({
      availableModules,
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
        onboardingStatus: company.onboardingStatus,
        enabledModules: company.enabledModules,
      })),
      moduleVisibilitySummary: buildModuleUsage(companies),
    });
  },

  async createAdmin(
    user: AuthenticatedUser | undefined,
    input: CreateSuperadminAdminRequest,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const existingUser = await authRepository.findUserByEmail(input.email);

    if (existingUser) {
      return fail(409, "A user with this email already exists.");
    }

    const passwordPolicyFailure =
      await validateManualPassword<SuperadminAdminMutationResponse>(input.password);

    if (passwordPolicyFailure) {
      return passwordPolicyFailure;
    }

    if (input.companyId) {
      const company = await companiesRepository.findCompanyById(input.companyId);

      if (!company) {
        return fail(404, "Company not found.");
      }
    }

    try {
      const createdAdmin = await usersService.createAdminUser({
        ...input,
        companyId: undefined,
      });

      if (!createdAdmin) {
        return fail(404, "Unable to create the admin account.");
      }

      if (input.companyId) {
        await companiesRepository.assignCompanyAdmin(input.companyId, createdAdmin.id);
      }

      const admin = await superadminRepository.findAdminById(createdAdmin.id);

      if (!admin) {
        return fail(404, "Unable to load the created admin account.");
      }

      void auditService.recordAction(user, {
        companyId: input.companyId ?? null,
        action: "admin.created",
        entityType: "admin",
        entityId: admin.id,
        metadata: {
          admin: {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.email,
            status: admin.status,
          },
          assignedCompanyId: input.companyId ?? null,
        },
      });

      return ok({
        message: input.companyId
          ? "Company admin created and assigned successfully."
          : "Company admin created successfully.",
        admin,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A user with this email already exists.");
      }

      if (input.companyId && isForeignKeyViolation(error)) {
        return fail(404, "Company not found.");
      }

      throw error;
    }
  },

  async updateAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
    input: UpdateSuperadminAdminRequest,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    const nextFullName = input.fullName ?? admin.fullName;
    const nextEmail = input.email ?? admin.email;
    const nextPhone =
      typeof input.phone === "undefined" ? admin.phone : input.phone;

    if (nextEmail !== admin.email) {
      const existingUser = await authRepository.findUserByEmail(nextEmail);

      if (existingUser && existingUser.id !== adminUserId) {
        return fail(409, "A user with this email already exists.");
      }
    }

    const changedFields: Record<string, { previous: unknown; next: unknown }> = {};

    if (nextFullName !== admin.fullName) {
      changedFields.fullName = {
        previous: admin.fullName,
        next: nextFullName,
      };
    }

    if (nextEmail !== admin.email) {
      changedFields.email = {
        previous: admin.email,
        next: nextEmail,
      };
    }

    if (nextPhone !== admin.phone) {
      changedFields.phone = {
        previous: admin.phone,
        next: nextPhone,
      };
    }

    const updatedAdmin = await superadminRepository.updateAdminProfile(adminUserId, {
      fullName: nextFullName,
      email: nextEmail,
      phone: nextPhone,
    });

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    if (Object.keys(changedFields).length > 0) {
      void auditService.recordAction(user, {
        companyId: null,
        action: "admin_updated",
        entityType: "admin",
        entityId: updatedAdmin.id,
        metadata: {
          admin: summarizeAdmin(updatedAdmin),
          changedFields,
        },
      });
    }

    return ok({
      message:
        Object.keys(changedFields).length > 0
          ? "Admin profile updated successfully."
          : "Admin profile is already up to date.",
      admin: updatedAdmin,
    });
  },

  async resetAdminPassword(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminPasswordResetResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.id === user.id) {
      return fail(
        403,
        "You cannot reset your own password from the admin-action workspace.",
      );
    }

    const passwordPolicy = await getPasswordPolicy();
    const temporaryPassword = generateTemporaryPassword(passwordPolicy);
    const updatedAdmin = await superadminRepository.resetAdminPassword(
      admin.id,
      hashPassword(temporaryPassword),
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin_password_reset",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: summarizeAdmin(updatedAdmin),
      },
    });

    return ok({
      message:
        "Temporary password generated successfully. Share it securely with the admin.",
      admin: updatedAdmin,
      temporaryPassword,
    });
  },

  async setAdminPassword(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
    input: SetSuperadminAdminPasswordRequest,
  ): Promise<SuperadminServiceResult<SuperadminAdminPasswordSetResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.id === user.id) {
      return fail(
        403,
        "You cannot change your own password from the admin-action workspace.",
      );
    }

    const passwordPolicyFailure =
      await validateManualPassword<SuperadminAdminPasswordSetResponse>(
        input.newPassword,
      );

    if (passwordPolicyFailure) {
      return passwordPolicyFailure;
    }

    const updatedAdmin = await superadminRepository.setAdminPassword(
      admin.id,
      hashPassword(input.newPassword),
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin_password_set",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: summarizeAdmin(updatedAdmin),
        mode: "manual-set",
      },
    });

    return ok({
      message:
        "Admin password updated successfully. Share the new credential securely with the admin.",
      admin: updatedAdmin,
    });
  },

  async unassignAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
    input: UnassignSuperadminAdminRequest,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const [admin, company, ownedCompanies] = await Promise.all([
      superadminRepository.findAdminById(adminUserId),
      companiesRepository.findCompanyById(input.companyId),
      superadminRepository.listAdminOwnedCompanies(adminUserId),
    ]);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (!company) {
      return fail(404, "Company not found.");
    }

    const ownsCompany = ownedCompanies.some(
      (ownedCompany) => ownedCompany.id === input.companyId,
    );

    if (!ownsCompany) {
      return fail(409, "This admin is not assigned to the selected company.");
    }

    if (
      company.status === "active" &&
      company.onboardingStatus === "active" &&
      !company.archivedAt
    ) {
      return fail(
        409,
        "Active companies require an assigned admin. Reassign the company before unassigning its current owner.",
      );
    }

    const unassigned = await superadminRepository.unassignAdminFromCompany(
      admin.id,
      input.companyId,
    );

    if (!unassigned) {
      return fail(409, "This admin is not assigned to the selected company.");
    }

    const updatedAdmin = await superadminRepository.findAdminById(admin.id);

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: input.companyId,
      action: "admin_unassigned",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: summarizeAdmin(updatedAdmin),
        company: {
          id: company.id,
          name: company.name,
          code: company.code,
        },
      },
    });

    return ok({
      message: "Admin unassigned from the company successfully.",
      admin: updatedAdmin,
    });
  },

  async suspendAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.id === user.id) {
      return fail(403, "You cannot suspend your own account from this workspace.");
    }

    if (admin.status === "suspended") {
      return fail(409, "This admin account is already suspended.");
    }

    if (admin.status === "inactive") {
      return fail(
        409,
        "Inactive admin accounts must be enabled before they can be suspended.",
      );
    }

    const updatedAdmin = await superadminRepository.updateAdminAccountState(
      admin.id,
      {
        isActive: false,
        suspendedAt: new Date().toISOString(),
      },
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin_suspended",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: summarizeAdmin(updatedAdmin),
      },
    });

    return ok({
      message: "Admin suspended successfully.",
      admin: updatedAdmin,
    });
  },

  async resumeAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.status !== "suspended") {
      return fail(
        409,
        admin.status === "active"
          ? "This admin account is already active."
          : "Inactive admin accounts must be enabled through the existing enable flow.",
      );
    }

    const updatedAdmin = await superadminRepository.updateAdminAccountState(
      admin.id,
      {
        isActive: true,
        suspendedAt: null,
      },
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin_resumed",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: summarizeAdmin(updatedAdmin),
      },
    });

    return ok({
      message: "Admin resumed successfully.",
      admin: updatedAdmin,
    });
  },

  async disableAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const [admin, ownedCompanies] = await Promise.all([
      superadminRepository.findAdminById(adminUserId),
      superadminRepository.listAdminOwnedCompanies(adminUserId),
    ]);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.id === user.id) {
      return fail(403, "You cannot disable your own account from this workspace.");
    }

    if (ownedCompanies.length > 0) {
      return fail(
        409,
        "Cannot disable the last admin of a company. Reassign the company owner first.",
      );
    }

    if (admin.status === "inactive") {
      return fail(409, "This admin account is already inactive.");
    }

    const updatedAdmin = await superadminRepository.updateAdminAccountState(
      admin.id,
      {
        isActive: false,
        suspendedAt: null,
      },
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin.disabled",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: {
          id: updatedAdmin.id,
          fullName: updatedAdmin.fullName,
          email: updatedAdmin.email,
          status: updatedAdmin.status,
        },
      },
    });

    return ok({
      message: "Admin disabled successfully.",
      admin: updatedAdmin,
    });
  },

  async enableAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const admin = await superadminRepository.findAdminById(adminUserId);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.status === "active") {
      return fail(409, "This admin account is already active.");
    }

    const updatedAdmin = await superadminRepository.updateAdminAccountState(
      admin.id,
      {
        isActive: true,
        suspendedAt: null,
      },
    );

    if (!updatedAdmin) {
      return fail(404, "Admin account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "admin.enabled",
      entityType: "admin",
      entityId: updatedAdmin.id,
      metadata: {
        admin: {
          id: updatedAdmin.id,
          fullName: updatedAdmin.fullName,
          email: updatedAdmin.email,
          status: updatedAdmin.status,
        },
      },
    });

    return ok({
      message: "Admin enabled successfully.",
      admin: updatedAdmin,
    });
  },

  async deleteAdmin(
    user: AuthenticatedUser | undefined,
    adminUserId: string,
  ): Promise<SuperadminServiceResult<SuperadminAdminDeleteResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const [admin, ownedCompanies] = await Promise.all([
      superadminRepository.findAdminById(adminUserId),
      superadminRepository.listAdminOwnedCompanies(adminUserId),
    ]);

    if (!admin) {
      return fail(404, "Admin account not found.");
    }

    if (admin.id === user.id) {
      return fail(403, "You cannot delete your own account from this workspace.");
    }

    if (ownedCompanies.length > 0) {
      return fail(
        409,
        "Cannot delete the last admin of a company. Reassign the company owner first.",
      );
    }

    try {
      const deletedAdminId = await superadminRepository.deleteAdmin(admin.id);

      if (!deletedAdminId) {
        return fail(404, "Admin account not found.");
      }

      void auditService.recordAction(user, {
        companyId: null,
        action: "admin.deleted",
        entityType: "admin",
        entityId: deletedAdminId,
        metadata: {
          admin: {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.email,
            status: admin.status,
          },
        },
      });

      return ok({
        message: "Admin deleted successfully.",
        deletedAdminId,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return fail(
          409,
          "This admin account is referenced by existing records and cannot be deleted safely.",
        );
      }

      throw error;
    }
  },

  async getAuditLogs(
    user: AuthenticatedUser | undefined,
    filters: SuperadminAuditLogFilters = {},
  ): Promise<SuperadminServiceResult<SuperadminAuditLogsResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const normalizedFilters = {
      companyId: normalizeFilterValue(filters.companyId),
      action: normalizeFilterValue(filters.action),
      dateFrom: normalizeDateOnly(filters.dateFrom),
      dateTo: normalizeDateOnly(filters.dateTo),
    };

    if (
      normalizedFilters.dateFrom &&
      normalizedFilters.dateTo &&
      normalizedFilters.dateFrom > normalizedFilters.dateTo
    ) {
      return fail(400, "The audit date range is invalid.");
    }

    const pagination = normalizePagination(filters.page, filters.pageSize);
    const [companies, totalLogs, filteredLogs, logs, actions] = await Promise.all([
      companiesService.listCompanies(),
      auditRepository.countAllAuditLogs(),
      auditRepository.countGlobalAuditLogs(normalizedFilters),
      auditRepository.listGlobalAuditLogs(normalizedFilters, pagination),
      auditRepository.listGlobalAuditActions(),
    ]);

    return ok({
      summary: {
        totalLogs,
        filteredLogs,
        uniqueCompanies: companies.length,
        uniqueActions: actions.length,
      },
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.max(1, Math.ceil(filteredLogs / pagination.pageSize)),
        totalItems: filteredLogs,
      },
      activeFilters: {
        companyId: normalizedFilters.companyId,
        action: normalizedFilters.action,
        dateFrom: normalizedFilters.dateFrom,
        dateTo: normalizedFilters.dateTo,
      },
      availableCompanies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
        onboardingStatus: company.onboardingStatus,
      })),
      availableActions: actions,
      logs,
    });
  },

  async getSettings(
    user: AuthenticatedUser | undefined,
  ): Promise<SuperadminServiceResult<SuperadminSettingsResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    return ok({
      settings: await superadminSettingsRepository.getSettings(),
    });
  },

  async updateSettings(
    user: AuthenticatedUser | undefined,
    input: UpdateSuperadminSettingsRequest,
  ): Promise<SuperadminServiceResult<SuperadminSettingsMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const currentSettings = await superadminSettingsRepository.getSettings();
    const nextSettings = {
      general: {
        platformName: input.general.platformName.trim(),
        platformDomain: input.general.platformDomain.trim().toLowerCase(),
        supportEmail: input.general.supportEmail.trim().toLowerCase(),
        timezone: input.general.timezone.trim(),
        dateFormat: input.general.dateFormat.trim(),
      },
      security: {
        minimumPasswordLength: input.security.minimumPasswordLength,
        enforceGlobalMfa: input.security.enforceGlobalMfa,
        googleSsoEnabled: input.security.googleSsoEnabled,
        samlSsoEnabled: input.security.samlSsoEnabled,
        requireUppercase: input.security.requireUppercase,
        requireNumber: input.security.requireNumber,
        requireSpecialCharacter: input.security.requireSpecialCharacter,
        sessionTimeoutMinutes: input.security.sessionTimeoutMinutes,
      },
      notifications: {
        companyUserCreated: input.notifications.companyUserCreated,
        assetAssigned: input.notifications.assetAssigned,
        leaveStatusChanged: input.notifications.leaveStatusChanged,
        procurementCreated: input.notifications.procurementCreated,
      },
      modules: {
        defaultEnabledModules: normalizeCompanyModules(
          input.modules.defaultEnabledModules,
        ),
      },
      operations: {
        maintenanceMode: input.operations.maintenanceMode,
        maintenanceScope: input.operations.maintenanceScope,
        maintenanceTargets: [...input.operations.maintenanceTargets],
      },
    };
    const changedEntries = flattenSettingsChanges(currentSettings, nextSettings);
    const changedKeys = changedEntries.map((entry) => entry.key);

    if (changedKeys.length === 0) {
      return ok({
        message: "Platform settings are already up to date.",
        settings: currentSettings,
      });
    }

    const settings = await superadminSettingsRepository.upsertSettings(nextSettings);

    void auditService.recordAction(user, {
      companyId: null,
      action: "superadmin_settings_updated",
      entityType: "superadmin_settings",
      entityId: "global",
      metadata: {
        changedKeys,
        previousValues: Object.fromEntries(
          changedEntries.map((entry) => [entry.key, entry.previous]),
        ),
        nextValues: Object.fromEntries(
          changedEntries.map((entry) => [entry.key, entry.next]),
        ),
      },
    });

    return ok({
      message: "Platform settings updated successfully.",
      settings,
    });
  },
};
