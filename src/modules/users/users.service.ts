import { authRepository } from "../auth/auth.repository.js";
import { generateTemporaryPassword, hashPassword } from "../auth/auth.password.js";
import {
  getPasswordPolicy,
  validatePasswordAgainstPolicy,
} from "../auth/password-policy.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { auditService } from "../audit/audit.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { superadminRepository } from "../superadmin/superadmin.repository.js";
import { readEmployeeProfilePhoto } from "../employee-self/employee-self.storage.js";
import { usersRepository } from "./users.repository.js";
import type {
  CompanyScopedUser,
  CompanyUserDeleteResponse,
  CompanyUserNotificationResponse,
  CompanyUserRoleSummary,
  CompanyUserPasswordSetResponse,
  CompanyUserPasswordResetResponse,
  CompanyUsersWorkspaceResponse,
  CompanyUsersWorkspaceFilters,
  CreateAdminUserInput,
  CreateCompanyUserRequest,
  CompanyUserMutationResponse,
  GlobalUserDeleteResponse,
  GlobalUserForceLogoutResponse,
  GlobalUserMutationResponse,
  GlobalUserPasswordResetResponse,
  GlobalUserProfile,
  GlobalUsersWorkspaceResponse,
  GlobalUsersWorkspaceFilters,
  SendCompanyUserNotificationRequest,
  SetCompanyUserPasswordRequest,
  UpdateGlobalUserRequest,
  UpdateCompanyUserRequest,
  UpdateCompanyUserStatusRequest,
  UsersServiceResult,
} from "./users.types.js";
import {
  getCompanyManagedRoleOptions,
  getGlobalUserRoleOptions,
  isCompanyManagedUserRole,
} from "./users.types.js";

function ok<T>(data: T): UsersServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): UsersServiceResult<T> {
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

function isForeignKeyViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}

function summarizeCompanyUsers(
  summary: Pick<
    CompanyUsersWorkspaceResponse["summary"],
    | "totalUsers"
    | "activeUsers"
    | "inactiveUsers"
    | "onLeaveToday"
    | "newJoinersThisMonth"
    | "employeeGrowthThisMonth"
    | "newJoinersPreviousMonth"
  >,
  filteredUsers: number,
  roleSummary: readonly CompanyUserRoleSummary[],
) {
  return {
    totalUsers: summary.totalUsers,
    activeUsers: summary.activeUsers,
    inactiveUsers: summary.inactiveUsers,
    onLeaveToday: summary.onLeaveToday,
    newJoinersThisMonth: summary.newJoinersThisMonth,
    employeeGrowthThisMonth: summary.employeeGrowthThisMonth,
    newJoinersPreviousMonth: summary.newJoinersPreviousMonth,
    configuredRoles: roleSummary.length,
    filteredUsers,
  };
}

function normalizeFilterValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePagination(page?: number | null, pageSize?: number | null) {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  const safePageSize =
    Number.isInteger(pageSize) && (pageSize as number) > 0
      ? Math.min(pageSize as number, 100)
      : 10;

  return {
    page: safePage,
    pageSize: safePageSize,
  };
}

function summarizeUser(user: CompanyScopedUser | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    isCompanyAdminOwner: user.isCompanyAdminOwner,
  };
}

function buildChangedFields(
  previous: CompanyScopedUser,
  next: CompanyScopedUser,
) {
  const changedFields: Record<string, { previous: unknown; next: unknown }> = {};

  if (previous.fullName !== next.fullName) {
    changedFields.fullName = {
      previous: previous.fullName,
      next: next.fullName,
    };
  }

  if (previous.email !== next.email) {
    changedFields.email = {
      previous: previous.email,
      next: next.email,
    };
  }

  if (previous.role !== next.role) {
    changedFields.role = {
      previous: previous.role,
      next: next.role,
    };
  }

  if (previous.status !== next.status) {
    changedFields.status = {
      previous: previous.status,
      next: next.status,
    };
  }

  return changedFields;
}

function isSuperadminUser(
  user: AuthenticatedUser | undefined,
): user is AuthenticatedUser {
  return Boolean(user && user.role === "superadmin");
}

function summarizeGlobalUser(
  user: Pick<
    GlobalUserProfile,
    "id" | "fullName" | "email" | "role" | "status" | "companyMappings"
  > | null,
) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    companyMappings: user.companyMappings.map((mapping) => ({
      id: mapping.id,
      name: mapping.name,
      code: mapping.code,
      isPrimary: mapping.isPrimary,
    })),
  };
}

function buildGlobalChangedFields(
  previous: Pick<GlobalUserProfile, "fullName" | "email" | "status">,
  next: Pick<GlobalUserProfile, "fullName" | "email" | "status">,
) {
  const changedFields: Record<string, { previous: unknown; next: unknown }> = {};

  if (previous.fullName !== next.fullName) {
    changedFields.fullName = {
      previous: previous.fullName,
      next: next.fullName,
    };
  }

  if (previous.email !== next.email) {
    changedFields.email = {
      previous: previous.email,
      next: next.email,
    };
  }

  if (previous.status !== next.status) {
    changedFields.status = {
      previous: previous.status,
      next: next.status,
    };
  }

  return changedFields;
}

function resolveGlobalUserState(
  status: UpdateGlobalUserRequest["status"],
  currentStatus: GlobalUserProfile["status"],
) {
  if (!status || status === currentStatus) {
    return {
      isActive: null,
      setSuspendedAt: null,
      suspendedAt: null,
    };
  }

  const targetStatus = status ?? currentStatus;

  if (targetStatus === "suspended") {
    return {
      isActive: false,
      setSuspendedAt: true,
      suspendedAt: new Date().toISOString(),
    };
  }

  return {
    isActive: targetStatus === "active",
    setSuspendedAt: true,
    suspendedAt: null,
  };
}

async function resolveManagedCompany(user: AuthenticatedUser) {
  if (!user.companyId) {
    return {
      ok: false as const,
      status: 403 as const,
      message: "Your account is not assigned to a company context.",
    };
  }

  const company = await companiesService.getCompanyView(user.companyId);

  if (!company) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "Company not found.",
    };
  }

  if (
    company.status !== "active" ||
    company.onboardingStatus !== "active" ||
    company.archivedAt
  ) {
    return {
      ok: false as const,
      status: 403 as const,
      message: "Only active companies can manage users from this workspace.",
    };
  }

  return {
    ok: true as const,
    company,
  };
}

export const usersService = {
  listAdminUsers() {
    return usersRepository.listAdminUsers();
  },

  async createAdminUser(input: CreateAdminUserInput) {
    return usersRepository.createAdminUser({
      ...input,
      email: input.email.toLowerCase(),
      passwordHash: hashPassword(input.password),
    });
  },

  async getGlobalUsersWorkspace(
    user: AuthenticatedUser | undefined,
    filters: GlobalUsersWorkspaceFilters = {},
  ): Promise<UsersServiceResult<GlobalUsersWorkspaceResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const normalizedFilters = {
      search: normalizeFilterValue(filters.search),
      role: filters.role ?? null,
      status: filters.status ?? null,
      companyId: normalizeFilterValue(filters.companyId),
      ...normalizePagination(filters.page, filters.pageSize),
    };

    const [summaryTotals, availableCompanies, globalUsers] = await Promise.all([
      usersRepository.getGlobalUsersSummaryTotals(),
      usersRepository.listGlobalUserCompanies(),
      usersRepository.listGlobalUsers(normalizedFilters),
    ]);

    return ok({
      summary: summaryTotals,
      users: globalUsers.items,
      availableRoles: getGlobalUserRoleOptions(),
      availableCompanies,
      activeFilters: {
        search: normalizedFilters.search,
        role: normalizedFilters.role,
        status: normalizedFilters.status,
        companyId: normalizedFilters.companyId,
      },
      pagination: globalUsers.pagination,
    });
  },

  async getGlobalUserProfile(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<{ user: GlobalUserProfile }>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    return ok({
      user: existingUser,
    });
  },

  async updateGlobalUser(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
    input: UpdateGlobalUserRequest,
  ): Promise<UsersServiceResult<GlobalUserMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    const nextFullName = input.fullName ?? existingUser.fullName;
    const nextEmail = (input.email ?? existingUser.email).toLowerCase();
    const nextStatus = input.status ?? existingUser.status;

    if (nextEmail !== existingUser.email) {
      const duplicateUser = await authRepository.findUserByEmail(nextEmail);

      if (duplicateUser && duplicateUser.id !== existingUser.id) {
        return fail(409, "A user with this email already exists.");
      }
    }

    if (existingUser.role === "admin" && nextStatus === "inactive") {
      const ownedCompanies = await superadminRepository.listAdminOwnedCompanies(
        existingUser.id,
      );

      if (ownedCompanies.length > 0) {
        return fail(
          409,
          "Cannot deactivate an assigned company admin. Reassign the company owner first.",
        );
      }
    }

    const nextState = resolveGlobalUserState(input.status, existingUser.status);
    let updatedUser: Awaited<ReturnType<typeof usersRepository.updateGlobalUser>>;

    try {
      updatedUser = await usersRepository.updateGlobalUser(existingUser.id, {
        fullName: nextFullName,
        email: nextEmail,
        status: input.status,
        isActive:
          typeof nextState.isActive === "boolean" ? nextState.isActive : undefined,
        setSuspendedAt:
          typeof nextState.setSuspendedAt === "boolean"
            ? nextState.setSuspendedAt
            : undefined,
        suspendedAt: nextState.suspendedAt,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A user with this email already exists.");
      }

      throw error;
    }

    if (!updatedUser) {
      return fail(404, "User account not found.");
    }

    const changedFields = buildGlobalChangedFields(existingUser, updatedUser);

    if (Object.keys(changedFields).length > 0) {
      void auditService.recordAction(user, {
        companyId: null,
        action: "user_updated",
        entityType: "user",
        entityId: updatedUser.id,
        metadata: {
          user: summarizeGlobalUser(updatedUser),
          changedFields,
        },
      });
    }

    let message = "User is already up to date.";

    if (Object.keys(changedFields).length > 0) {
      if (Object.keys(changedFields).length === 1 && changedFields.status) {
        message =
          updatedUser.status === "active"
            ? "User activated successfully."
            : updatedUser.status === "inactive"
              ? "User deactivated successfully."
              : "User suspended successfully.";
      } else {
        message = "User updated successfully.";
      }
    }

    return ok({
      message,
      user: updatedUser,
    });
  },

  async resetGlobalUserPassword(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<GlobalUserPasswordResetResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "You cannot reset your own password from the global user management workspace.",
      );
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const updatedUser = await usersRepository.resetGlobalUserPassword(
      existingUser.id,
      hashPassword(temporaryPassword),
    );

    if (!updatedUser) {
      return fail(404, "User account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "user_password_reset",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeGlobalUser(updatedUser),
      },
    });

    return ok({
      message:
        "Temporary password generated successfully. Share it securely with the user.",
      user: updatedUser,
      temporaryPassword,
    });
  },

  async forceLogoutGlobalUser(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<GlobalUserForceLogoutResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "You cannot invalidate your own session from the global user management workspace.",
      );
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    const updatedUser = await usersRepository.forceLogoutGlobalUser(existingUser.id);

    if (!updatedUser) {
      return fail(404, "User account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "user_sessions_invalidated",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeGlobalUser(updatedUser),
      },
    });

    return ok({
      message: "Active sessions invalidated successfully.",
      user: updatedUser,
    });
  },

  async suspendGlobalUser(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<GlobalUserMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    if (existingUser.status === "suspended") {
      return fail(409, "This user account is already suspended.");
    }

    const updatedUser = await usersRepository.updateGlobalUserAccountState(
      existingUser.id,
      {
        isActive: false,
        suspendedAt: new Date().toISOString(),
      },
    );

    if (!updatedUser) {
      return fail(404, "User account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "user_suspended",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeGlobalUser(updatedUser),
      },
    });

    return ok({
      message: "User suspended successfully.",
      user: updatedUser,
    });
  },

  async resumeGlobalUser(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<GlobalUserMutationResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    if (existingUser.status !== "suspended") {
      return fail(
        409,
        existingUser.status === "active"
          ? "This user account is already active."
          : "Inactive user accounts must be activated from the profile update flow.",
      );
    }

    const updatedUser = await usersRepository.updateGlobalUserAccountState(
      existingUser.id,
      {
        isActive: true,
        suspendedAt: null,
      },
    );

    if (!updatedUser) {
      return fail(404, "User account not found.");
    }

    void auditService.recordAction(user, {
      companyId: null,
      action: "user_resumed",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeGlobalUser(updatedUser),
      },
    });

    return ok({
      message: "User resumed successfully.",
      user: updatedUser,
    });
  },

  async deleteGlobalUser(
    user: AuthenticatedUser | undefined,
    targetUserId: string,
  ): Promise<UsersServiceResult<GlobalUserDeleteResponse>> {
    if (!isSuperadminUser(user)) {
      return fail(403, "Only superadmin accounts can access this workspace.");
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "You cannot delete your own account from the global user management workspace.",
      );
    }

    const existingUser = await usersRepository.findGlobalUserProfileById(targetUserId);

    if (!existingUser) {
      return fail(404, "User account not found.");
    }

    if (existingUser.role === "admin") {
      const ownedCompanies = await superadminRepository.listAdminOwnedCompanies(
        existingUser.id,
      );

      if (ownedCompanies.length > 0) {
        return fail(
          409,
          "Cannot delete an assigned company admin. Reassign company ownership first.",
        );
      }
    }

    try {
      const deletedUserId = await usersRepository.deleteGlobalUser(existingUser.id);

      if (!deletedUserId) {
        return fail(404, "User account not found.");
      }

      void auditService.recordAction(user, {
        companyId: null,
        action: "user_deleted",
        entityType: "user",
        entityId: deletedUserId,
        metadata: {
          user: summarizeGlobalUser(existingUser),
        },
      });

      return ok({
        message: "User deleted successfully.",
        deletedUserId,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return fail(
          409,
          "This user is still referenced by operational records and cannot be deleted safely.",
        );
      }

      throw error;
    }
  },

  async getCompanyUsersWorkspace(
    user: AuthenticatedUser,
    filters: CompanyUsersWorkspaceFilters = {},
  ): Promise<UsersServiceResult<CompanyUsersWorkspaceResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    const companyId = managedCompany.company.id;
    const normalizedFilters = {
      search: normalizeFilterValue(filters.search),
      role: filters.role ?? null,
      status: filters.status ?? null,
      departmentId: normalizeFilterValue(filters.departmentId),
      office: normalizeFilterValue(filters.office),
      ...normalizePagination(filters.page, filters.pageSize),
    };

    const [
      companyUsers,
      roleSummary,
      summaryTotals,
      availableDepartments,
      availableOffices,
    ] = await Promise.all([
      usersRepository.listCompanyUsers(companyId, normalizedFilters),
      usersRepository.getCompanyUserRoleSummary(companyId),
      usersRepository.getCompanyUsersSummaryTotals(companyId),
      usersRepository.listCompanyUserDepartments(companyId),
      usersRepository.listCompanyUserOfficeOptions(companyId),
    ]);

    return ok({
      company: {
        id: managedCompany.company.id,
        name: managedCompany.company.name,
        code: managedCompany.company.code,
        status: managedCompany.company.status,
      },
      summary: summarizeCompanyUsers(
        summaryTotals,
        companyUsers.pagination.totalItems,
        roleSummary,
      ),
      users: companyUsers.items,
      roleSummary,
      availableRoles: getCompanyManagedRoleOptions(),
      availableDepartments,
      availableOffices,
      activeFilters: {
        search: normalizedFilters.search,
        role: normalizedFilters.role,
        status: normalizedFilters.status,
        departmentId: normalizedFilters.departmentId,
        office: normalizedFilters.office,
      },
      pagination: companyUsers.pagination,
    });
  },

  async createCompanyUser(
    user: AuthenticatedUser,
    input: CreateCompanyUserRequest,
  ): Promise<UsersServiceResult<CompanyUserMutationResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    const existingUser = await authRepository.findUserByEmail(input.email);

    if (existingUser) {
      return fail(409, "A user with this email already exists.");
    }

    const passwordPolicyFailure =
      await validateManualPassword<CompanyUserMutationResponse>(input.password);

    if (passwordPolicyFailure) {
      return passwordPolicyFailure;
    }

    try {
      const createdUser = await usersRepository.createCompanyUser({
        ...input,
        companyId: managedCompany.company.id,
        email: input.email.toLowerCase(),
        passwordHash: hashPassword(input.password),
      });

      if (!createdUser) {
        return fail(404, "Unable to create the user account.");
      }

      void notificationsService.notifyUser(managedCompany.company.id, createdUser.id, {
        type: "company.user.created",
        title: "Company account created",
        message:
          input.status === "active"
            ? `Your company account for ${managedCompany.company.name} has been created and is ready to use.`
            : `Your company account for ${managedCompany.company.name} has been created and is currently inactive.`,
        entityType: "company_user",
        entityId: createdUser.id,
      });

      void auditService.recordAction(user, {
        action: "user.created",
        entityType: "user",
        entityId: createdUser.id,
        metadata: {
          createdUser: {
            id: createdUser.id,
            fullName: createdUser.fullName,
            email: createdUser.email,
            role: createdUser.role,
            status: createdUser.status,
          },
        },
      });

      return ok({
        message: "Company user created successfully.",
        user: createdUser,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(409, "A user with this email already exists.");
      }

      throw error;
    }
  },

  async updateCompanyUserStatus(
    user: AuthenticatedUser,
    targetUserId: string,
    input: UpdateCompanyUserStatusRequest,
  ): Promise<UsersServiceResult<CompanyUserMutationResponse>> {
    const result = await this.updateCompanyUser(user, targetUserId, {
      status: input.status,
    });

    if (!result.ok) {
      return result;
    }

    return ok({
      message:
        input.status === "active"
          ? "User activated successfully."
          : "User deactivated successfully.",
      user: result.data.user,
    });
  },

  async updateCompanyUser(
    user: AuthenticatedUser,
    targetUserId: string,
    input: UpdateCompanyUserRequest,
  ): Promise<UsersServiceResult<CompanyUserMutationResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    const existingUser = await usersRepository.findCompanyUserById(
      managedCompany.company.id,
      targetUserId,
    );

    if (!existingUser) {
      return fail(404, "Company user not found.");
    }

    if (existingUser.isCompanyAdminOwner) {
      return fail(
        403,
        "The assigned company admin owner must be managed through the superadmin assignment flow.",
      );
    }

    if (!isCompanyManagedUserRole(existingUser.role)) {
      return fail(
        403,
        "Only company-managed users can be reset from this workspace.",
      );
    }

    if (!isCompanyManagedUserRole(existingUser.role)) {
      return fail(
        403,
        "Only company-managed users can be updated from this workspace.",
      );
    }

    const nextFullName = input.fullName ?? existingUser.fullName;
    const nextEmail = (input.email ?? existingUser.email).toLowerCase();
    const nextRole = input.role ?? existingUser.role;
    const nextStatus = input.status ?? existingUser.status;

    if (nextEmail !== existingUser.email) {
      const duplicateUser = await authRepository.findUserByEmail(nextEmail);

      if (duplicateUser && duplicateUser.id !== existingUser.id) {
        return fail(409, "A user with this email already exists.");
      }
    }

    const updatedUser = await usersRepository.updateCompanyUser(
      managedCompany.company.id,
      existingUser.id,
      {
        fullName: nextFullName,
        email: nextEmail,
        role: nextRole,
        status: nextStatus,
      },
    );

    if (!updatedUser) {
      return fail(404, "Company user not found.");
    }

    const changedFields = buildChangedFields(existingUser, updatedUser);

    if (Object.keys(changedFields).length > 0) {
      void auditService.recordAction(user, {
        action: "user_updated",
        entityType: "user",
        entityId: updatedUser.id,
        metadata: {
          user: summarizeUser(updatedUser),
          changedFields,
        },
      });
    }

    return ok({
      message:
        Object.keys(changedFields).length > 0
          ? "Company user updated successfully."
          : "Company user is already up to date.",
      user: updatedUser,
    });
  },

  async resetCompanyUserPassword(
    user: AuthenticatedUser,
    targetUserId: string,
  ): Promise<UsersServiceResult<CompanyUserPasswordResetResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "You cannot reset your own password from the company user management workspace.",
      );
    }

    const existingUser = await usersRepository.findCompanyUserById(
      managedCompany.company.id,
      targetUserId,
    );

    if (!existingUser) {
      return fail(404, "Company user not found.");
    }

    if (existingUser.isCompanyAdminOwner) {
      return fail(
        403,
        "The assigned company admin owner must be managed through the superadmin assignment flow.",
      );
    }

    if (!isCompanyManagedUserRole(existingUser.role)) {
      return fail(
        403,
        "Only company-managed users can be deleted from this workspace.",
      );
    }

    const passwordPolicy = await getPasswordPolicy();
    const temporaryPassword = generateTemporaryPassword(passwordPolicy);
    const updatedUser = await usersRepository.resetCompanyUserPassword(
      managedCompany.company.id,
      targetUserId,
      hashPassword(temporaryPassword),
    );

    if (!updatedUser) {
      return fail(404, "Company user not found.");
    }

    void auditService.recordAction(user, {
      action: "user_password_reset",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeUser(updatedUser),
      },
    });

    return ok({
      message:
        "Temporary password generated successfully. Share it securely with the user.",
      user: updatedUser,
      temporaryPassword,
    });
  },

  async setCompanyUserPassword(
    user: AuthenticatedUser,
    targetUserId: string,
    input: SetCompanyUserPasswordRequest,
  ): Promise<UsersServiceResult<CompanyUserPasswordSetResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "Use the account settings page to change your own password.",
      );
    }

    const existingUser = await usersRepository.findCompanyUserById(
      managedCompany.company.id,
      targetUserId,
    );

    if (!existingUser) {
      return fail(404, "Company user not found.");
    }

    if (existingUser.isCompanyAdminOwner) {
      return fail(
        403,
        "The assigned company admin owner must change password from the account settings flow.",
      );
    }

    if (!isCompanyManagedUserRole(existingUser.role)) {
      return fail(
        403,
        "Only company-managed users can have passwords changed from this workspace.",
      );
    }

    const passwordPolicyFailure =
      await validateManualPassword<CompanyUserPasswordSetResponse>(
        input.newPassword,
      );

    if (passwordPolicyFailure) {
      return passwordPolicyFailure;
    }

    const updatedUser = await usersRepository.setCompanyUserPassword(
      managedCompany.company.id,
      targetUserId,
      hashPassword(input.newPassword),
    );

    if (!updatedUser) {
      return fail(404, "Company user not found.");
    }

    void auditService.recordAction(user, {
      action: "user_password_set",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        user: summarizeUser(updatedUser),
        mode: "manual-set",
      },
    });

    return ok({
      message:
        "User password updated successfully. Share the new credential securely with the user.",
      user: updatedUser,
    });
  },

  async sendCompanyUserNotification(
    user: AuthenticatedUser,
    input: SendCompanyUserNotificationRequest,
  ): Promise<UsersServiceResult<CompanyUserNotificationResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    const uniqueUserIds = Array.from(new Set(input.userIds));
    const existingUsers = await Promise.all(
      uniqueUserIds.map((userId) =>
        usersRepository.findCompanyUserById(managedCompany.company.id, userId),
      ),
    );

    if (existingUsers.some((entry) => !entry)) {
      return fail(404, "One or more selected employees were not found.");
    }

    await notificationsService.notifyUsers(managedCompany.company.id, uniqueUserIds, {
      type: "announcement.posted",
      title: input.title,
      message: input.message,
      entityType: "company_user_notification",
      entityId: managedCompany.company.id,
    });

    void auditService.recordAction(user, {
      action: "user_notification_sent",
      entityType: "user",
      entityId: managedCompany.company.id,
      metadata: {
        notifiedUserIds: uniqueUserIds,
        title: input.title,
      },
    });

    return ok({
      message: `Notification sent to ${uniqueUserIds.length} employee${uniqueUserIds.length === 1 ? "" : "s"}.`,
      notifiedUserIds: uniqueUserIds,
    });
  },

  async getCompanyUserProfilePhoto(
    user: AuthenticatedUser,
    targetUserId: string,
  ): Promise<
    UsersServiceResult<{
      buffer: Buffer;
      mimeType: string;
    }>
  > {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    const existingUser = await usersRepository.findCompanyUserById(
      managedCompany.company.id,
      targetUserId,
    );

    if (!existingUser) {
      return fail(404, "Company user not found.");
    }

    if (!existingUser.profilePhotoUrl) {
      return fail(404, "Profile photo not found.");
    }

    const photo = await readEmployeeProfilePhoto(existingUser.profilePhotoUrl);

    return ok(photo);
  },

  async deleteCompanyUser(
    user: AuthenticatedUser,
    targetUserId: string,
  ): Promise<UsersServiceResult<CompanyUserDeleteResponse>> {
    const managedCompany = await resolveManagedCompany(user);

    if (!managedCompany.ok) {
      return fail(managedCompany.status, managedCompany.message);
    }

    if (targetUserId === user.id) {
      return fail(
        403,
        "You cannot delete your own account from the company user management workspace.",
      );
    }

    const existingUser = await usersRepository.findCompanyUserById(
      managedCompany.company.id,
      targetUserId,
    );

    if (!existingUser) {
      return fail(404, "Company user not found.");
    }

    if (existingUser.isCompanyAdminOwner) {
      return fail(
        403,
        "The assigned company admin owner must be managed through the superadmin assignment flow.",
      );
    }

    try {
      const deletedUserId = await usersRepository.deleteCompanyUser(
        managedCompany.company.id,
        targetUserId,
      );

      if (!deletedUserId) {
        return fail(404, "Company user not found.");
      }

      void auditService.recordAction(user, {
        action: "user_deleted",
        entityType: "user",
        entityId: deletedUserId,
        metadata: {
          user: summarizeUser(existingUser),
        },
      });

      return ok({
        message: "Company user deleted successfully.",
        deletedUserId,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return fail(
          409,
          "This company user is still referenced by operational records and cannot be deleted safely.",
        );
      }

      throw error;
    }
  },
};
