import type { CompanyStatus } from "../companies/companies.types.js";
import type { PermissionKey } from "../permissions/permissions.types.js";
import type { EmployeeAssetsWorkspaceResponse } from "../assets/assets.types.js";
import type { EmployeeShiftResponse } from "../shifts/shifts.types.js";
import type {
  CompanyUserProfile,
  UserAccountStatus,
} from "../users/users.types.js";
import type { AppRole } from "../roles/roles.types.js";

export const EMPLOYEE_PROFILE_GENDERS = [
  "male",
  "female",
  "other",
  "prefer-not-to-say",
] as const;
export const EMPLOYEE_PROFILE_MARITAL_STATUSES = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
  "prefer-not-to-say",
] as const;
export const EMPLOYEE_PROFILE_EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "intern",
  "consultant",
] as const;
export const PROFILE_CHANGE_REQUEST_TYPES = [
  "bank-details",
  "job-information",
] as const;
export const PROFILE_CHANGE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type EmployeeProfileGender = (typeof EMPLOYEE_PROFILE_GENDERS)[number];
export type EmployeeProfileMaritalStatus =
  (typeof EMPLOYEE_PROFILE_MARITAL_STATUSES)[number];
export type EmployeeProfileEmploymentType =
  (typeof EMPLOYEE_PROFILE_EMPLOYMENT_TYPES)[number];
export type ProfileChangeRequestType =
  (typeof PROFILE_CHANGE_REQUEST_TYPES)[number];
export type ProfileChangeRequestStatus =
  (typeof PROFILE_CHANGE_REQUEST_STATUSES)[number];

export type EmployeeProfileActorSummary = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
};

export type EmployeeProfileManagerSummary = Pick<
  EmployeeProfileActorSummary,
  "id" | "fullName" | "email"
>;

export type EmployeeProfileEmployeeSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role" | "status" | "department" | "designation"
>;

export type EmployeeSelfProfile = Omit<
  CompanyUserProfile,
  "todayAttendance" | "monthlyAttendance" | "documentsCount" | "recentActivity"
> & {
  phone: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  gender: EmployeeProfileGender | null;
  maritalStatus: EmployeeProfileMaritalStatus | null;
  bloodGroup: string | null;
  nationality: string | null;
  languages: string[];
  employeeId: string | null;
  reportingManager: EmployeeProfileManagerSummary | null;
  workLocation: string | null;
  employmentType: EmployeeProfileEmploymentType | null;
  bio: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  profilePhotoUrl: string | null;
};

export type EmployeeSelfBankDetails = {
  bankName: string | null;
  accountHolderName: string | null;
  accountNumberMasked: string | null;
  ifsc: string | null;
  pan: string | null;
  uan: string | null;
  verifiedAt: string | null;
  verifiedBy: EmployeeProfileActorSummary | null;
};

export type UpdateEmployeeSelfBankDetailsRequest = {
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  pan?: string | null;
  uan?: string | null;
};

export type EmployeeSelfBankDetailsMutationResponse = {
  message: string;
  bankDetails: EmployeeSelfBankDetails | null;
};

export type EmployeeEducationRecord = {
  id: string;
  degree: string;
  institution: string;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  grade: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeSkillRecord = {
  id: string;
  name: string;
  category: string | null;
  proficiency: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAchievementRecord = {
  id: string;
  title: string;
  issuer: string | null;
  achievedAt: string | null;
  credentialUrl: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileChangeRequestRecord = {
  id: string;
  userId: string;
  employee: EmployeeProfileEmployeeSummary;
  requestType: ProfileChangeRequestType;
  status: ProfileChangeRequestStatus;
  requestedChanges: Record<string, unknown>;
  reason: string | null;
  reviewNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: EmployeeProfileActorSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeSelfOverviewResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    roleLabel: string;
    accountStatus: UserAccountStatus;
    departmentAssigned: boolean;
    designationAssigned: boolean;
    pendingProfileChangeRequests: number;
  };
  profile: EmployeeSelfProfile;
  account: {
    dashboardPath: string;
    memberSince: string;
    lastUpdated: string;
    permissions: PermissionKey[];
  };
  shift: EmployeeShiftResponse["shift"];
  shiftAssignment: EmployeeShiftResponse["assignment"];
  bankDetails: EmployeeSelfBankDetails | null;
  education: EmployeeEducationRecord[];
  skills: EmployeeSkillRecord[];
  achievements: EmployeeAchievementRecord[];
  changeRequests: ProfileChangeRequestRecord[];
};

export type EmployeeDashboardCalendarEventType =
  | "attendance"
  | "shift"
  | "holiday"
  | "event"
  | "meeting"
  | "training"
  | "reminder"
  | "leave"
  | "announcement";

export type EmployeeDashboardCalendarEventStatus =
  | "present"
  | "absent"
  | "late"
  | "half-day"
  | "approved"
  | "pending"
  | "rejected"
  | "high"
  | "medium"
  | "low"
  | "scheduled";

export type EmployeeDashboardCalendarAttendanceDetails = {
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  recordStatus:
    | "checked-in"
    | "present"
    | "late"
    | "half-day"
    | "missing"
    | "pending"
    | "absent";
  durationMinutes: number | null;
  lateStatus: "on-time" | "late" | "not-evaluated";
  lateByMinutes: number | null;
  workDurationDeltaMinutes: number | null;
  notes: string[];
  updatedAt: string;
};

export type EmployeeDashboardCalendarEvent = {
  id: string;
  title: string;
  type: EmployeeDashboardCalendarEventType;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  href?: string | null;
  status?: EmployeeDashboardCalendarEventStatus | null;
  attendance?: EmployeeDashboardCalendarAttendanceDetails | null;
};

export type EmployeeDashboardCalendarUpcomingResponse = {
  items: EmployeeDashboardCalendarEvent[];
};

export type UpdateEmployeeSelfProfileRequest = {
  phone?: string | null;
  personalEmail?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  gender?: EmployeeProfileGender | null;
  maritalStatus?: EmployeeProfileMaritalStatus | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  languages?: string[];
  bio?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
};

export type EmployeeSelfProfileMutationResponse = {
  message: string;
  profile: EmployeeSelfProfile;
};

export type EmployeeSelfPhotoMutationResponse = {
  message: string;
  profile: EmployeeSelfProfile;
};

export type EmployeeSelfSettings = {
  permanentAddress: string | null;
  emailNotifications: boolean;
  marketingEmails: boolean;
  attendanceAlerts: boolean;
  leaveUpdates: boolean;
  announcementAlerts: boolean;
  payrollNotifications: boolean;
};

export type EmployeeSelfSettingsResponse = {
  settings: EmployeeSelfSettings;
};

export type UpdateEmployeeSelfSettingsRequest = {
  permanentAddress?: string | null;
  emailNotifications?: boolean;
  marketingEmails?: boolean;
  attendanceAlerts?: boolean;
  leaveUpdates?: boolean;
  announcementAlerts?: boolean;
  payrollNotifications?: boolean;
};

export type EmployeeSelfSettingsMutationResponse = {
  message: string;
  settings: EmployeeSelfSettings;
};

export type CreateEmployeeEducationRequest = {
  degree: string;
  institution: string;
  fieldOfStudy?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  description?: string | null;
};

export type UpdateEmployeeEducationRequest = {
  degree?: string | null;
  institution?: string | null;
  fieldOfStudy?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  description?: string | null;
};

export type EmployeeEducationListResponse = {
  items: EmployeeEducationRecord[];
};

export type EmployeeEducationMutationResponse = {
  message: string;
  education: EmployeeEducationRecord;
};

export type EmployeeEducationDeleteResponse = {
  message: string;
  deletedEducationId: string;
};

export type CreateEmployeeSkillRequest = {
  name: string;
  category?: string | null;
  proficiency?: number | null;
};

export type UpdateEmployeeSkillRequest = {
  name?: string | null;
  category?: string | null;
  proficiency?: number | null;
};

export type EmployeeSkillListResponse = {
  items: EmployeeSkillRecord[];
};

export type EmployeeSkillMutationResponse = {
  message: string;
  skill: EmployeeSkillRecord;
};

export type EmployeeSkillDeleteResponse = {
  message: string;
  deletedSkillId: string;
};

export type CreateEmployeeAchievementRequest = {
  title: string;
  issuer?: string | null;
  achievedAt?: string | null;
  credentialUrl?: string | null;
  description?: string | null;
};

export type UpdateEmployeeAchievementRequest = {
  title?: string | null;
  issuer?: string | null;
  achievedAt?: string | null;
  credentialUrl?: string | null;
  description?: string | null;
};

export type EmployeeAchievementListResponse = {
  items: EmployeeAchievementRecord[];
};

export type EmployeeAchievementMutationResponse = {
  message: string;
  achievement: EmployeeAchievementRecord;
};

export type EmployeeAchievementDeleteResponse = {
  message: string;
  deletedAchievementId: string;
};

export type CreateProfileChangeRequestRequest = {
  requestType: ProfileChangeRequestType;
  requestedChanges: Record<string, unknown>;
  reason?: string | null;
};

export type ReviewProfileChangeRequestRequest = {
  status: Extract<ProfileChangeRequestStatus, "approved" | "rejected">;
  reviewNotes?: string | null;
};

export type EmployeeProfileChangeRequestListResponse = {
  items: ProfileChangeRequestRecord[];
};

export type EmployeeProfileChangeRequestMutationResponse = {
  message: string;
  request: ProfileChangeRequestRecord;
};

export type HrProfileChangeRequestWorkspaceResponse = {
  items: ProfileChangeRequestRecord[];
  summary: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    cancelledRequests: number;
  };
};

export type HrProfileChangeRequestMutationResponse = {
  message: string;
  request: ProfileChangeRequestRecord;
};

export type EmployeeSelfAssetsResponse = EmployeeAssetsWorkspaceResponse;

export type EmployeeSelfPhotoAsset = {
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type EmployeeSelfServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type EmployeeSelfServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type EmployeeSelfServiceResult<T> =
  | EmployeeSelfServiceSuccess<T>
  | EmployeeSelfServiceFailure;

export function isEmployeeProfileGender(
  value: string,
): value is EmployeeProfileGender {
  return EMPLOYEE_PROFILE_GENDERS.includes(value as EmployeeProfileGender);
}

export function isEmployeeProfileMaritalStatus(
  value: string,
): value is EmployeeProfileMaritalStatus {
  return EMPLOYEE_PROFILE_MARITAL_STATUSES.includes(
    value as EmployeeProfileMaritalStatus,
  );
}

export function isEmployeeProfileEmploymentType(
  value: string,
): value is EmployeeProfileEmploymentType {
  return EMPLOYEE_PROFILE_EMPLOYMENT_TYPES.includes(
    value as EmployeeProfileEmploymentType,
  );
}

export function isProfileChangeRequestType(
  value: string,
): value is ProfileChangeRequestType {
  return PROFILE_CHANGE_REQUEST_TYPES.includes(value as ProfileChangeRequestType);
}

export function isProfileChangeRequestStatus(
  value: string,
): value is ProfileChangeRequestStatus {
  return PROFILE_CHANGE_REQUEST_STATUSES.includes(
    value as ProfileChangeRequestStatus,
  );
}
