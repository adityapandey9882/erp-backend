// import {
//   ROLE_DEFINITIONS,
//   type AppRole,
//   type RoleDefinition,
// } from "../roles/roles.types.js";
// import type {
//   CompanyOnboardingStatus,
//   CompanyStatus,
// } from "../companies/companies.types.js";

// export const USER_ACCOUNT_STATUSES = ["active", "inactive"] as const;
// export const GLOBAL_USER_ACCOUNT_STATUSES = [
//   "active",
//   "inactive",
//   "suspended",
// ] as const;
// export const COMPANY_MANAGED_USER_ROLES = [
//   "hr",
//   "accounts",
//   "project-manager",
//   "team-lead",
//   "employee",
// ] as const;

// export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];
// export type GlobalUserAccountStatus =
//   (typeof GLOBAL_USER_ACCOUNT_STATUSES)[number];
// export type CompanyManagedUserRole = (typeof COMPANY_MANAGED_USER_ROLES)[number];
// export type CompanyUsersFilterRole = Exclude<AppRole, "superadmin">;
// export type GlobalUsersFilterRole = Exclude<AppRole, "superadmin">;

// export type AdminDirectoryUser = {
//   id: string;
//   fullName: string;
//   email: string;
//   status: UserAccountStatus;
//   createdAt: string;
// };

// export type CompanyScopedUser = {
//   id: string;
//   fullName: string;
//   email: string;
//   phone: string | null;
//   employeeId: string | null;
//   role: AppRole;
//   status: UserAccountStatus;
//   createdAt: string;
//   updatedAt: string;
//   workLocation: string | null;
//   employmentType: string | null;
//   profilePhotoUrl: string | null;
//   reportingManager: CompanyUserManagerSummary | null;
//   department: CompanyUserDepartmentSummary | null;
//   designation: CompanyUserDesignationSummary | null;
//   todayAttendance: CompanyUserTodayAttendance;
//   monthlyAttendance: CompanyUserMonthlyAttendance;
//   documentsCount: number;
//   recentActivity: CompanyUserRecentActivity[];
//   isCompanyAdminOwner: boolean;
// };

// export type CompanyUserTodayAttendanceStatus =
//   | "present"
//   | "late"
//   | "absent"
//   | "on-leave"
//   | "not-checked-in";

// export type CompanyUserTodayAttendance = {
//   status: CompanyUserTodayAttendanceStatus;
//   label: string;
//   checkInAt: string | null;
//   checkOutAt: string | null;
// };

// export type CompanyUserMonthlyAttendance = {
//   present: number;
//   late: number;
//   absent: number;
//   onLeave: number;
//   attendancePercent: number;
// };

// export type CompanyUserRecentActivity = {
//   id: string;
//   label: string;
//   occurredAt: string;
// };

// export type CompanyUserManagerSummary = {
//   id: string;
//   fullName: string;
//   email: string;
// };

// export type CompanyUserDepartmentSummary = {
//   id: string;
//   name: string;
//   code: string;
// };

// export type CompanyUserDesignationSummary = {
//   id: string;
//   title: string;
//   code: string;
//   department: CompanyUserDepartmentSummary | null;
// };

// export type CompanyUserProfile = CompanyScopedUser & {
//   department: CompanyUserDepartmentSummary | null;
//   designation: CompanyUserDesignationSummary | null;
// };

// export type GlobalUserCompanyMapping = {
//   id: string;
//   name: string;
//   code: string;
//   status: CompanyStatus;
//   onboardingStatus: CompanyOnboardingStatus;
//   archivedAt: string | null;
//   isPrimary: boolean;
// };

// export type GlobalUserView = {
//   id: string;
//   fullName: string;
//   email: string;
//   phone: string | null;
//   role: AppRole;
//   roleLabel: string;
//   status: GlobalUserAccountStatus;
//   createdAt: string;
//   updatedAt: string;
//   suspendedAt: string | null;
//   lastLoginAt: string | null;
//   primaryCompany: GlobalUserCompanyMapping | null;
//   companyMappings: GlobalUserCompanyMapping[];
// };

// export type GlobalUserProfile = GlobalUserView & {
//   personalEmail: string | null;
//   emergencyContactName: string | null;
//   emergencyContactPhone: string | null;
//   address: string | null;
//   department: CompanyUserDepartmentSummary | null;
//   designation: CompanyUserDesignationSummary | null;
// };

// export type GlobalUserRoleOption = Pick<
//   RoleDefinition,
//   "role" | "label" | "description"
// > & {
//   role: GlobalUsersFilterRole;
// };

// export type CompanyUserRoleSummary = {
//   role: AppRole;
//   label: string;
//   totalUsers: number;
//   activeUsers: number;
//   inactiveUsers: number;
// };

// export type CompanyUserRoleOption = Pick<
//   RoleDefinition,
//   "role" | "label" | "description"
// > & {
//   role: CompanyManagedUserRole;
// };

// export type CompanyUsersWorkspaceResponse = {
//   company: {
//     id: string;
//     name: string;
//     code: string;
//     status: CompanyStatus;
//   } | null;
//   summary: {
//     totalUsers: number;
//     activeUsers: number;
//     inactiveUsers: number;
//     onLeaveToday: number;
//     newJoinersThisMonth: number;
//     employeeGrowthThisMonth: number;
//     newJoinersPreviousMonth: number;
//     configuredRoles: number;
//     filteredUsers: number;
//   };
//   users: CompanyScopedUser[];
//   roleSummary: CompanyUserRoleSummary[];
//   availableRoles: CompanyUserRoleOption[];
//   availableDepartments: CompanyUserDepartmentSummary[];
//   availableOffices: string[];
//   activeFilters: {
//     search: string | null;
//     role: CompanyUsersFilterRole | null;
//     status: UserAccountStatus | null;
//     departmentId: string | null;
//     office: string | null;
//   };
//   pagination: {
//     page: number;
//     pageSize: number;
//     totalPages: number;
//     totalItems: number;
//   };
// };

// export type CompanyUsersWorkspaceFilters = {
//   search?: string | null;
//   role?: CompanyUsersFilterRole | null;
//   status?: UserAccountStatus | null;
//   departmentId?: string | null;
//   office?: string | null;
//   page?: number;
//   pageSize?: number;
// };

// export type GlobalUsersWorkspaceResponse = {
//   summary: {
//     totalUsers: number;
//     activeUsers: number;
//     inactiveUsers: number;
//     suspendedUsers: number;
//     totalCompanies: number;
//   };
//   users: GlobalUserView[];
//   availableRoles: GlobalUserRoleOption[];
//   availableCompanies: Array<{
//     id: string;
//     name: string;
//     code: string;
//     status: CompanyStatus;
//     onboardingStatus: CompanyOnboardingStatus;
//     archivedAt: string | null;
//   }>;
//   activeFilters: {
//     search: string | null;
//     role: GlobalUsersFilterRole | null;
//     status: GlobalUserAccountStatus | null;
//     companyId: string | null;
//   };
//   pagination: {
//     page: number;
//     pageSize: number;
//     totalPages: number;
//     totalItems: number;
//   };
// };

// export type GlobalUsersWorkspaceFilters = {
//   search?: string | null;
//   role?: GlobalUsersFilterRole | null;
//   status?: GlobalUserAccountStatus | null;
//   companyId?: string | null;
//   page?: number;
//   pageSize?: number;
// };

// export type CreateAdminUserInput = {
//   fullName: string;
//   email: string;
//   password: string;
//   status: UserAccountStatus;
//   companyId?: string;
// };

// export type CreateAdminUserRecordInput = Omit<CreateAdminUserInput, "password"> & {
//   passwordHash: string;
// };

// export type CreateCompanyUserRequest = {
//   fullName: string;
//   email: string;
//   password: string;
//   role: CompanyManagedUserRole;
//   status: UserAccountStatus;
// };

// export type CreateCompanyUserInput = CreateCompanyUserRequest & {
//   companyId: string;
// };

// export type CreateCompanyUserRecordInput = Omit<
//   CreateCompanyUserInput,
//   "password"
// > & {
//   passwordHash: string;
// };

// export type UpdateCompanyUserStatusRequest = {
//   status: UserAccountStatus;
// };

// export type SetCompanyUserPasswordRequest = {
//   newPassword: string;
//   confirmPassword: string;
// };

// export type SendCompanyUserNotificationRequest = {
//   userIds: string[];
//   title: string;
//   message: string;
// };

// export type UpdateCompanyUserRequest = {
//   fullName?: string;
//   email?: string;
//   role?: CompanyManagedUserRole;
//   status?: UserAccountStatus;
// };

// export type UpdateGlobalUserRequest = {
//   fullName?: string;
//   email?: string;
//   status?: GlobalUserAccountStatus;
// };

// export type UpdateCompanyUserOrganizationProfileRequest = {
//   departmentId?: string | null;
//   designationId?: string | null;
// };

// export type CompanyUserMutationResponse = {
//   message: string;
//   user: CompanyScopedUser;
// };

// export type CompanyUserPasswordResetResponse = {
//   message: string;
//   user: CompanyScopedUser;
//   temporaryPassword: string;
// };

// export type CompanyUserPasswordSetResponse = {
//   message: string;
//   user: CompanyScopedUser;
// };

// export type CompanyUserNotificationResponse = {
//   message: string;
//   notifiedUserIds: string[];
// };

// export type CompanyUserDeleteResponse = {
//   message: string;
//   deletedUserId: string;
// };

// export type GlobalUserMutationResponse = {
//   message: string;
//   user: GlobalUserView;
// };

// export type GlobalUserPasswordResetResponse = {
//   message: string;
//   user: GlobalUserView;
//   temporaryPassword: string;
// };

// export type GlobalUserForceLogoutResponse = {
//   message: string;
//   user: GlobalUserView;
// };

// export type GlobalUserDeleteResponse = {
//   message: string;
//   deletedUserId: string;
// };

// export type UsersServiceSuccess<T> = {
//   ok: true;
//   data: T;
// };

// export type UsersServiceFailure = {
//   ok: false;
//   status: 400 | 403 | 404 | 409;
//   message: string;
// };

// export type UsersServiceResult<T> = UsersServiceSuccess<T> | UsersServiceFailure;

// export function isUserAccountStatus(value: string): value is UserAccountStatus {
//   return USER_ACCOUNT_STATUSES.includes(value as UserAccountStatus);
// }

// export function isCompanyManagedUserRole(
//   value: string,
// ): value is CompanyManagedUserRole {
//   return COMPANY_MANAGED_USER_ROLES.includes(value as CompanyManagedUserRole);
// }

// export function isGlobalUserAccountStatus(
//   value: string,
// ): value is GlobalUserAccountStatus {
//   return GLOBAL_USER_ACCOUNT_STATUSES.includes(value as GlobalUserAccountStatus);
// }

// export function getUserAccountStatus(isActive: boolean): UserAccountStatus {
//   return isActive ? "active" : "inactive";
// }

// export function getGlobalUserAccountStatus(
//   isActive: boolean,
//   suspendedAt: Date | string | null,
// ): GlobalUserAccountStatus {
//   if (!isActive && suspendedAt) {
//     return "suspended";
//   }

//   return isActive ? "active" : "inactive";
// }

// export function isUserAccountActive(status: UserAccountStatus) {
//   return status === "active";
// }

// export function getCompanyManagedRoleOptions(): CompanyUserRoleOption[] {
//   return COMPANY_MANAGED_USER_ROLES.map((role) => {
//     const definition = ROLE_DEFINITIONS[role];

//     return {
//       role,
//       label: definition.label,
//       description: definition.description,
//     };
//   });
// }

// export function getGlobalUserRoleOptions(): GlobalUserRoleOption[] {
//   return (Object.keys(ROLE_DEFINITIONS) as AppRole[])
//     .filter((role): role is GlobalUsersFilterRole => role !== "superadmin")
//     .map((role) => {
//       const definition = ROLE_DEFINITIONS[role];

//       return {
//         role,
//         label: definition.label,
//         description: definition.description,
//       };
//     });
// }




import {
  ROLE_DEFINITIONS,
  type AppRole,
  type RoleDefinition,
} from "../roles/roles.types.js";
import type {
  CompanyOnboardingStatus,
  CompanyStatus,
} from "../companies/companies.types.js";

export const USER_ACCOUNT_STATUSES = ["active", "inactive"] as const;
export const GLOBAL_USER_ACCOUNT_STATUSES = [
  "active",
  "inactive",
  "suspended",
] as const;
export const COMPANY_MANAGED_USER_ROLES = [
  "hr",
  "accounts",
  "project-manager",
  "team-lead",
  "employee",
] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];
export type GlobalUserAccountStatus =
  (typeof GLOBAL_USER_ACCOUNT_STATUSES)[number];
export type CompanyManagedUserRole = (typeof COMPANY_MANAGED_USER_ROLES)[number];
export type CompanyUsersFilterRole = Exclude<AppRole, "superadmin">;
export type GlobalUsersFilterRole = Exclude<AppRole, "superadmin">;

export type AdminDirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  status: UserAccountStatus;
  createdAt: string;
};

export type CompanyScopedUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  role: AppRole;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
  workLocation: string | null;
  employmentType: string | null;
  profilePhotoUrl: string | null;
  reportingManager: CompanyUserManagerSummary | null;
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
  todayAttendance: CompanyUserTodayAttendance;
  monthlyAttendance: CompanyUserMonthlyAttendance;
  documentsCount: number;
  recentActivity: CompanyUserRecentActivity[];
  isCompanyAdminOwner: boolean;
};

export type CompanyUserTodayAttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "on-leave"
  | "not-checked-in";

export type CompanyUserTodayAttendance = {
  status: CompanyUserTodayAttendanceStatus;
  label: string;
  checkInAt: string | null;
  checkOutAt: string | null;
};

export type CompanyUserMonthlyAttendance = {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  attendancePercent: number;
};

export type CompanyUserRecentActivity = {
  id: string;
  label: string;
  occurredAt: string;
};

export type CompanyUserManagerSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type CompanyUserDepartmentSummary = {
  id: string;
  name: string;
  code: string;
};

export type CompanyUserDesignationSummary = {
  id: string;
  title: string;
  code: string;
  department: CompanyUserDepartmentSummary | null;
};

export type CompanyUserProfile = CompanyScopedUser & {
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
};

export type GlobalUserCompanyMapping = {
  id: string;
  name: string;
  code: string;
  status: CompanyStatus;
  onboardingStatus: CompanyOnboardingStatus;
  archivedAt: string | null;
  isPrimary: boolean;
};

export type GlobalUserView = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: AppRole;
  roleLabel: string;
  status: GlobalUserAccountStatus;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  lastLoginAt: string | null;
  primaryCompany: GlobalUserCompanyMapping | null;
  companyMappings: GlobalUserCompanyMapping[];
};

export type GlobalUserProfile = GlobalUserView & {
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
  department: CompanyUserDepartmentSummary | null;
  designation: CompanyUserDesignationSummary | null;
};

export type GlobalUserRoleOption = Pick<
  RoleDefinition,
  "role" | "label" | "description"
> & {
  role: GlobalUsersFilterRole;
};

export type CompanyUserRoleSummary = {
  role: AppRole;
  label: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
};

export type CompanyUserRoleOption = Pick<
  RoleDefinition,
  "role" | "label" | "description"
> & {
  role: CompanyManagedUserRole;
};

export type CompanyUsersWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  } | null;
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    onLeaveToday: number;
    newJoinersThisMonth: number;
    employeeGrowthThisMonth: number;
    newJoinersPreviousMonth: number;
    configuredRoles: number;
    filteredUsers: number;
  };
  users: CompanyScopedUser[];
  roleSummary: CompanyUserRoleSummary[];
  availableRoles: CompanyUserRoleOption[];
  availableDepartments: CompanyUserDepartmentSummary[];
  availableOffices: string[];
  activeFilters: {
    search: string | null;
    role: CompanyUsersFilterRole | null;
    status: UserAccountStatus | null;
    departmentId: string | null;
    office: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
};

export type CompanyUsersWorkspaceFilters = {
  search?: string | null;
  role?: CompanyUsersFilterRole | null;
  status?: UserAccountStatus | null;
  departmentId?: string | null;
  office?: string | null;
  page?: number;
  pageSize?: number;
};

export type GlobalUsersWorkspaceResponse = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    totalCompanies: number;
  };
  users: GlobalUserView[];
  availableRoles: GlobalUserRoleOption[];
  availableCompanies: Array<{
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
    onboardingStatus: CompanyOnboardingStatus;
    archivedAt: string | null;
  }>;
  activeFilters: {
    search: string | null;
    role: GlobalUsersFilterRole | null;
    status: GlobalUserAccountStatus | null;
    companyId: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
};

export type GlobalUsersWorkspaceFilters = {
  search?: string | null;
  role?: GlobalUsersFilterRole | null;
  status?: GlobalUserAccountStatus | null;
  companyId?: string | null;
  page?: number;
  pageSize?: number;
};

export type CreateAdminUserInput = {
  fullName: string;
  email: string;
  password: string;
  status: UserAccountStatus;
  companyId?: string;
};

export type CreateAdminUserRecordInput = Omit<CreateAdminUserInput, "password"> & {
  passwordHash: string;
};

export type CreateCompanyUserRequest = {
  fullName: string;
  email: string;
  password: string;
  role: CompanyManagedUserRole;
  status: UserAccountStatus;
};

export type CreateCompanyUserInput = CreateCompanyUserRequest & {
  companyId: string;
};

export type CreateCompanyUserRecordInput = Omit<
  CreateCompanyUserInput,
  "password"
> & {
  passwordHash: string;
};

export type UpdateCompanyUserStatusRequest = {
  status: UserAccountStatus;
};

export type SetCompanyUserPasswordRequest = {
  newPassword: string;
  confirmPassword: string;
};

export type SendCompanyUserNotificationRequest = {
  userIds: string[];
  title: string;
  message: string;
};

export type UpdateCompanyUserRequest = {
  fullName?: string;
  email?: string;
  role?: CompanyManagedUserRole;
  status?: UserAccountStatus;
};

export type UpdateGlobalUserRequest = {
  fullName?: string;
  email?: string;
  status?: GlobalUserAccountStatus;
};

export type UpdateCompanyUserOrganizationProfileRequest = {
  departmentId?: string | null;
  designationId?: string | null;
};

export type CompanyUserMutationResponse = {
  message: string;
  user: CompanyScopedUser;
};

export type CompanyUserPasswordResetResponse = {
  message: string;
  user: CompanyScopedUser;
  temporaryPassword: string;
};

export type CompanyUserPasswordSetResponse = {
  message: string;
  user: CompanyScopedUser;
};

export type CompanyUserNotificationResponse = {
  message: string;
  notifiedUserIds: string[];
};

export type CompanyUserDeleteResponse = {
  message: string;
  deletedUserId: string;
};

export type GlobalUserMutationResponse = {
  message: string;
  user: GlobalUserView;
};

export type GlobalUserPasswordResetResponse = {
  message: string;
  user: GlobalUserView;
  temporaryPassword: string;
};

export type GlobalUserForceLogoutResponse = {
  message: string;
  user: GlobalUserView;
};

export type GlobalUserDeleteResponse = {
  message: string;
  deletedUserId: string;
};

export type UsersServiceSuccess<T> = {
  ok: true;
  data: T;
  status?: never;
  message?: never;
};

export type UsersServiceFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 500;
  message: string;
  data?: never;
};

export type UsersServiceResult<T> =
  | UsersServiceSuccess<T>
  | UsersServiceFailure;

export function isUserAccountStatus(value: string): value is UserAccountStatus {
  return USER_ACCOUNT_STATUSES.includes(value as UserAccountStatus);
}

export function isCompanyManagedUserRole(
  value: string,
): value is CompanyManagedUserRole {
  return COMPANY_MANAGED_USER_ROLES.includes(value as CompanyManagedUserRole);
}

export function isGlobalUserAccountStatus(
  value: string,
): value is GlobalUserAccountStatus {
  return GLOBAL_USER_ACCOUNT_STATUSES.includes(value as GlobalUserAccountStatus);
}

export function getUserAccountStatus(isActive: boolean): UserAccountStatus {
  return isActive ? "active" : "inactive";
}

export function getGlobalUserAccountStatus(
  isActive: boolean,
  suspendedAt: Date | string | null,
): GlobalUserAccountStatus {
  if (!isActive && suspendedAt) {
    return "suspended";
  }

  return isActive ? "active" : "inactive";
}

export function isUserAccountActive(status: UserAccountStatus) {
  return status === "active";
}

export function getCompanyManagedRoleOptions(): CompanyUserRoleOption[] {
  return COMPANY_MANAGED_USER_ROLES.map((role) => {
    const definition = ROLE_DEFINITIONS[role];

    return {
      role,
      label: definition.label,
      description: definition.description,
    };
  });
}

export function getGlobalUserRoleOptions(): GlobalUserRoleOption[] {
  return (Object.keys(ROLE_DEFINITIONS) as AppRole[])
    .filter((role): role is GlobalUsersFilterRole => role !== "superadmin")
    .map((role) => {
      const definition = ROLE_DEFINITIONS[role];

      return {
        role,
        label: definition.label,
        description: definition.description,
      };
    });
}