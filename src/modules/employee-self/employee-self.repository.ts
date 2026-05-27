import { randomUUID } from "node:crypto";
import type { DatabaseExecutor } from "../../database/index.js";
import { query } from "../../database/index.js";
import type {
  EmployeeAchievementRecord,
  EmployeeEducationRecord,
  EmployeeProfileActorSummary,
  EmployeeProfileEmployeeSummary,
  EmployeeSelfBankDetails,
  EmployeeSelfProfile,
  EmployeeSelfSettings,
  EmployeeSkillRecord,
  ProfileChangeRequestRecord,
} from "./employee-self.types.js";

type EmployeeSelfProfileRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  isCompanyAdminOwner: boolean;
  phone: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
  dateOfBirth: Date | string | null;
  gender: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  languages: string[] | null;
  employeeId: string | null;
  workLocation: string | null;
  employmentType: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  profilePhotoUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
  reportingManagerId: string | null;
  reportingManagerFullName: string | null;
  reportingManagerEmail: string | null;
};

type EmployeeSelfSettingsRow = {
  permanentAddress: string | null;
  emailNotifications: boolean;
  marketingEmails: boolean;
  attendanceAlerts: boolean;
  leaveUpdates: boolean;
  announcementAlerts: boolean;
  payrollNotifications: boolean;
};

type EmployeeSelfBankDetailsRow = {
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  pan: string | null;
  uan: string | null;
  verifiedAt: Date | string | null;
  verifiedById: string | null;
  verifiedByFullName: string | null;
  verifiedByEmail: string | null;
  verifiedByRole: string | null;
};

type EmployeeEducationRow = {
  id: string;
  degree: string;
  institution: string;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  grade: string | null;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type EmployeeSkillRow = {
  id: string;
  name: string;
  category: string | null;
  proficiency: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type EmployeeAchievementRow = {
  id: string;
  title: string;
  issuer: string | null;
  achievedAt: Date | string | null;
  credentialUrl: string | null;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ProfileChangeRequestRow = {
  id: string;
  userId: string;
  requestType: string;
  status: string;
  requestedChanges: Record<string, unknown>;
  reason: string | null;
  reviewNotes: string | null;
  requestedAt: Date | string;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  employeeId: string;
  employeeFullName: string;
  employeeEmail: string;
  employeeRole: string;
  employeeIsActive: boolean;
  employeeCreatedAt: Date | string;
  employeeUpdatedAt: Date | string;
  employeeDepartmentId: string | null;
  employeeDepartmentName: string | null;
  employeeDepartmentCode: string | null;
  employeeDesignationId: string | null;
  employeeDesignationTitle: string | null;
  employeeDesignationCode: string | null;
  employeeDesignationDepartmentId: string | null;
  employeeDesignationDepartmentName: string | null;
  employeeDesignationDepartmentCode: string | null;
  reviewedById: string | null;
  reviewedByFullName: string | null;
  reviewedByEmail: string | null;
  reviewedByRole: string | null;
};

const defaultExecutor: DatabaseExecutor = { query };

function getDefaultSelfSettings(): EmployeeSelfSettings {
  return {
    permanentAddress: null,
    emailNotifications: true,
    marketingEmails: false,
    attendanceAlerts: true,
    leaveUpdates: true,
    announcementAlerts: true,
    payrollNotifications: true,
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return toIsoString(value);
}

function maskAccountNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\s+/g, "");
  const visible = digits.slice(-4);

  if (!visible) {
    return "****";
  }

  return `**** ${visible}`;
}

function mapActorSummary(input: {
  id: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
}): EmployeeProfileActorSummary | null {
  if (!input.id || !input.fullName || !input.email || !input.role) {
    return null;
  }

  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    role: input.role as EmployeeProfileActorSummary["role"],
  };
}

function mapDepartmentSummary(input: {
  id: string | null;
  name: string | null;
  code: string | null;
}) {
  if (!input.id) {
    return null;
  }

  return {
    id: input.id,
    name: input.name ?? "Unknown Department",
    code: input.code ?? "",
  };
}

function mapDesignationSummary(input: {
  id: string | null;
  title: string | null;
  code: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
}) {
  if (!input.id) {
    return null;
  }

  return {
    id: input.id,
    title: input.title ?? "Unknown Designation",
    code: input.code ?? "",
    department: mapDepartmentSummary({
      id: input.departmentId,
      name: input.departmentName,
      code: input.departmentCode,
    }),
  };
}

function mapEmployeeSelfProfile(
  row: EmployeeSelfProfileRow | undefined,
): EmployeeSelfProfile | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role as EmployeeSelfProfile["role"],
    status: row.isActive ? "active" : "inactive",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    isCompanyAdminOwner: row.isCompanyAdminOwner,
    phone: row.phone,
    personalEmail: row.personalEmail?.toLowerCase() ?? null,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    address: row.address,
    dateOfBirth: toNullableIsoString(row.dateOfBirth)?.slice(0, 10) ?? null,
    gender: row.gender as EmployeeSelfProfile["gender"],
    maritalStatus: row.maritalStatus as EmployeeSelfProfile["maritalStatus"],
    bloodGroup: row.bloodGroup,
    nationality: row.nationality,
    languages: row.languages ?? [],
    employeeId: row.employeeId,
    reportingManager: row.reportingManagerId
      ? {
          id: row.reportingManagerId,
          fullName: row.reportingManagerFullName ?? "Unknown Manager",
          email: row.reportingManagerEmail?.toLowerCase() ?? "",
        }
      : null,
    workLocation: row.workLocation,
    employmentType: row.employmentType as EmployeeSelfProfile["employmentType"],
    bio: row.bio,
    linkedinUrl: row.linkedinUrl,
    githubUrl: row.githubUrl,
    profilePhotoUrl: row.profilePhotoUrl,
    department: mapDepartmentSummary({
      id: row.departmentId,
      name: row.departmentName,
      code: row.departmentCode,
    }),
    designation: mapDesignationSummary({
      id: row.designationId,
      title: row.designationTitle,
      code: row.designationCode,
      departmentId: row.designationDepartmentId,
      departmentName: row.designationDepartmentName,
      departmentCode: row.designationDepartmentCode,
    }),
  };
}

function mapEmployeeSelfSettings(
  row: EmployeeSelfSettingsRow | undefined,
): EmployeeSelfSettings {
  if (!row) {
    return getDefaultSelfSettings();
  }

  return {
    permanentAddress: row.permanentAddress,
    emailNotifications: row.emailNotifications,
    marketingEmails: row.marketingEmails,
    attendanceAlerts: row.attendanceAlerts,
    leaveUpdates: row.leaveUpdates,
    announcementAlerts: row.announcementAlerts,
    payrollNotifications: row.payrollNotifications,
  };
}

function mapEmployeeSelfBankDetails(
  row: EmployeeSelfBankDetailsRow | undefined,
): EmployeeSelfBankDetails | null {
  if (!row) {
    return null;
  }

  return {
    bankName: row.bankName,
    accountHolderName: row.accountHolderName,
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    ifsc: row.ifsc,
    pan: row.pan,
    uan: row.uan,
    verifiedAt: toNullableIsoString(row.verifiedAt),
    verifiedBy: mapActorSummary({
      id: row.verifiedById,
      fullName: row.verifiedByFullName,
      email: row.verifiedByEmail,
      role: row.verifiedByRole,
    }),
  };
}

function mapEmployeeEducation(row: EmployeeEducationRow): EmployeeEducationRecord {
  return {
    id: row.id,
    degree: row.degree,
    institution: row.institution,
    fieldOfStudy: row.fieldOfStudy,
    startYear: row.startYear,
    endYear: row.endYear,
    grade: row.grade,
    description: row.description,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapEmployeeSkill(row: EmployeeSkillRow): EmployeeSkillRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    proficiency: row.proficiency,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapEmployeeAchievement(
  row: EmployeeAchievementRow,
): EmployeeAchievementRecord {
  return {
    id: row.id,
    title: row.title,
    issuer: row.issuer,
    achievedAt: toNullableIsoString(row.achievedAt)?.slice(0, 10) ?? null,
    credentialUrl: row.credentialUrl,
    description: row.description,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapEmployeeProfileEmployeeSummary(
  row: ProfileChangeRequestRow,
): EmployeeProfileEmployeeSummary {
  return {
    id: row.employeeId,
    fullName: row.employeeFullName,
    email: row.employeeEmail.toLowerCase(),
    role: row.employeeRole as EmployeeProfileEmployeeSummary["role"],
    status: row.employeeIsActive ? "active" : "inactive",
    department: mapDepartmentSummary({
      id: row.employeeDepartmentId,
      name: row.employeeDepartmentName,
      code: row.employeeDepartmentCode,
    }),
    designation: mapDesignationSummary({
      id: row.employeeDesignationId,
      title: row.employeeDesignationTitle,
      code: row.employeeDesignationCode,
      departmentId: row.employeeDesignationDepartmentId,
      departmentName: row.employeeDesignationDepartmentName,
      departmentCode: row.employeeDesignationDepartmentCode,
    }),
  };
}

function mapProfileChangeRequest(
  row: ProfileChangeRequestRow | undefined,
): ProfileChangeRequestRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    employee: mapEmployeeProfileEmployeeSummary(row),
    requestType: row.requestType as ProfileChangeRequestRecord["requestType"],
    status: row.status as ProfileChangeRequestRecord["status"],
    requestedChanges:
      row.requestedChanges && typeof row.requestedChanges === "object"
        ? row.requestedChanges
        : {},
    reason: row.reason,
    reviewNotes: row.reviewNotes,
    requestedAt: toIsoString(row.requestedAt),
    reviewedAt: toNullableIsoString(row.reviewedAt),
    reviewedBy: mapActorSummary({
      id: row.reviewedById,
      fullName: row.reviewedByFullName,
      email: row.reviewedByEmail,
      role: row.reviewedByRole,
    }),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const selfProfileSelect = `
  SELECT
    users.id,
    users.full_name AS "fullName",
    users.email,
    users.role,
    users.is_active AS "isActive",
    users.created_at AS "createdAt",
    users.updated_at AS "updatedAt",
    FALSE AS "isCompanyAdminOwner",
    users.phone,
    users.personal_email AS "personalEmail",
    users.emergency_contact_name AS "emergencyContactName",
    users.emergency_contact_phone AS "emergencyContactPhone",
    users.address,
    users.date_of_birth AS "dateOfBirth",
    users.gender,
    users.marital_status AS "maritalStatus",
    users.blood_group AS "bloodGroup",
    users.nationality,
    users.languages,
    users.employee_id AS "employeeId",
    users.work_location AS "workLocation",
    users.employment_type AS "employmentType",
    users.bio,
    users.linkedin_url AS "linkedinUrl",
    users.github_url AS "githubUrl",
    users.profile_photo_url AS "profilePhotoUrl",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode",
    reporting_manager.id AS "reportingManagerId",
    reporting_manager.full_name AS "reportingManagerFullName",
    reporting_manager.email AS "reportingManagerEmail"
  FROM users
  LEFT JOIN departments
    ON departments.id = users.department_id
    AND departments.company_id = $1
  LEFT JOIN designations
    ON designations.id = users.designation_id
    AND designations.company_id = $1
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = $1
  LEFT JOIN users AS reporting_manager
    ON reporting_manager.id = users.reporting_manager_id
    AND reporting_manager.company_id = $1
  WHERE users.company_id = $1
    AND users.id = $2
  LIMIT 1
`;

const bankDetailsSelect = `
  SELECT
    employee_bank_details.bank_name AS "bankName",
    employee_bank_details.account_holder_name AS "accountHolderName",
    employee_bank_details.account_number AS "accountNumber",
    employee_bank_details.ifsc,
    employee_bank_details.pan,
    employee_bank_details.uan,
    employee_bank_details.verified_at AS "verifiedAt",
    reviewer.id AS "verifiedById",
    reviewer.full_name AS "verifiedByFullName",
    reviewer.email AS "verifiedByEmail",
    reviewer.role AS "verifiedByRole"
  FROM employee_bank_details
  LEFT JOIN users AS reviewer
    ON reviewer.id = employee_bank_details.verified_by
  WHERE employee_bank_details.company_id = $1
    AND employee_bank_details.user_id = $2
  LIMIT 1
`;

const profileChangeRequestSelect = `
  SELECT
    requests.id,
    requests.user_id AS "userId",
    requests.request_type AS "requestType",
    requests.status,
    requests.requested_changes AS "requestedChanges",
    requests.reason,
    requests.review_notes AS "reviewNotes",
    requests.requested_at AS "requestedAt",
    requests.reviewed_at AS "reviewedAt",
    requests.created_at AS "createdAt",
    requests.updated_at AS "updatedAt",
    employee.id AS "employeeId",
    employee.full_name AS "employeeFullName",
    employee.email AS "employeeEmail",
    employee.role AS "employeeRole",
    employee.is_active AS "employeeIsActive",
    employee.created_at AS "employeeCreatedAt",
    employee.updated_at AS "employeeUpdatedAt",
    employee_departments.id AS "employeeDepartmentId",
    employee_departments.name AS "employeeDepartmentName",
    employee_departments.code AS "employeeDepartmentCode",
    employee_designations.id AS "employeeDesignationId",
    employee_designations.title AS "employeeDesignationTitle",
    employee_designations.code AS "employeeDesignationCode",
    employee_designation_departments.id AS "employeeDesignationDepartmentId",
    employee_designation_departments.name AS "employeeDesignationDepartmentName",
    employee_designation_departments.code AS "employeeDesignationDepartmentCode",
    reviewer.id AS "reviewedById",
    reviewer.full_name AS "reviewedByFullName",
    reviewer.email AS "reviewedByEmail",
    reviewer.role AS "reviewedByRole"
  FROM profile_change_requests AS requests
  JOIN users AS employee
    ON employee.id = requests.user_id
    AND employee.company_id = $1
  LEFT JOIN departments AS employee_departments
    ON employee_departments.id = employee.department_id
    AND employee_departments.company_id = $1
  LEFT JOIN designations AS employee_designations
    ON employee_designations.id = employee.designation_id
    AND employee_designations.company_id = $1
  LEFT JOIN departments AS employee_designation_departments
    ON employee_designation_departments.id = employee_designations.department_id
    AND employee_designation_departments.company_id = $1
  LEFT JOIN users AS reviewer
    ON reviewer.id = requests.reviewed_by
  WHERE requests.company_id = $1
`;

export const employeeSelfRepository = {
  async findSelfProfile(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSelfProfileRow>(selfProfileSelect, [
      companyId,
      userId,
    ]);

    return mapEmployeeSelfProfile(result.rows[0]);
  },

  async updateSelfProfile(
    companyId: string,
    userId: string,
    input: {
      phone: string | null;
      personalEmail: string | null;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
      address: string | null;
      dateOfBirth: string | null;
      gender: EmployeeSelfProfile["gender"];
      maritalStatus: EmployeeSelfProfile["maritalStatus"];
      bloodGroup: string | null;
      nationality: string | null;
      languages: string[];
      bio: string | null;
      linkedinUrl: string | null;
      githubUrl: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;

    const updateResult = await database.query<{ id: string }>(
      `
        UPDATE users
        SET
          phone = $3,
          personal_email = $4,
          emergency_contact_name = $5,
          emergency_contact_phone = $6,
          address = $7,
          date_of_birth = $8,
          gender = $9,
          marital_status = $10,
          blood_group = $11,
          nationality = $12,
          languages = $13,
          bio = $14,
          linkedin_url = $15,
          github_url = $16,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        companyId,
        userId,
        input.phone,
        input.personalEmail,
        input.emergencyContactName,
        input.emergencyContactPhone,
        input.address,
        input.dateOfBirth,
        input.gender,
        input.maritalStatus,
        input.bloodGroup,
        input.nationality,
        input.languages,
        input.bio,
        input.linkedinUrl,
        input.githubUrl,
      ],
    );

    if (!updateResult.rows[0]?.id) {
      return null;
    }

    return this.findSelfProfile(companyId, userId, database);
  },

  async updateSelfProfilePhoto(
    companyId: string,
    userId: string,
    storageReference: string | null,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{ id: string }>(
      `
        UPDATE users
        SET
          profile_photo_url = $3,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [companyId, userId, storageReference],
    );

    if (!result.rows[0]?.id) {
      return null;
    }

    return this.findSelfProfile(companyId, userId, database);
  },

  async findSelfSettings(userId: string, executor?: DatabaseExecutor) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSelfSettingsRow>(
      `
        SELECT
          user_settings.permanent_address AS "permanentAddress",
          user_settings.email_notifications AS "emailNotifications",
          user_settings.marketing_emails AS "marketingEmails",
          user_settings.attendance_alerts AS "attendanceAlerts",
          user_settings.leave_updates AS "leaveUpdates",
          user_settings.announcement_alerts AS "announcementAlerts",
          user_settings.payroll_notifications AS "payrollNotifications"
        FROM user_settings
        WHERE user_settings.user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return mapEmployeeSelfSettings(result.rows[0]);
  },

  async upsertSelfSettings(
    userId: string,
    input: EmployeeSelfSettings,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSelfSettingsRow>(
      `
        INSERT INTO user_settings (
          id,
          user_id,
          permanent_address,
          email_notifications,
          marketing_emails,
          attendance_alerts,
          leave_updates,
          announcement_alerts,
          payroll_notifications,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          permanent_address = EXCLUDED.permanent_address,
          email_notifications = EXCLUDED.email_notifications,
          marketing_emails = EXCLUDED.marketing_emails,
          attendance_alerts = EXCLUDED.attendance_alerts,
          leave_updates = EXCLUDED.leave_updates,
          announcement_alerts = EXCLUDED.announcement_alerts,
          payroll_notifications = EXCLUDED.payroll_notifications,
          updated_at = NOW()
        RETURNING
          permanent_address AS "permanentAddress",
          email_notifications AS "emailNotifications",
          marketing_emails AS "marketingEmails",
          attendance_alerts AS "attendanceAlerts",
          leave_updates AS "leaveUpdates",
          announcement_alerts AS "announcementAlerts",
          payroll_notifications AS "payrollNotifications"
      `,
      [
        randomUUID(),
        userId,
        input.permanentAddress,
        input.emailNotifications,
        input.marketingEmails,
        input.attendanceAlerts,
        input.leaveUpdates,
        input.announcementAlerts,
        input.payrollNotifications,
      ],
    );

    return mapEmployeeSelfSettings(result.rows[0]);
  },

  async findSelfBankDetails(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSelfBankDetailsRow>(
      bankDetailsSelect,
      [companyId, userId],
    );

    return mapEmployeeSelfBankDetails(result.rows[0]);
  },

  async findSelfBankDetailsForUpdate(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSelfBankDetailsRow>(
      bankDetailsSelect,
      [companyId, userId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      bankName: row.bankName,
      accountHolderName: row.accountHolderName,
      accountNumber: row.accountNumber,
      ifsc: row.ifsc,
      pan: row.pan,
      uan: row.uan,
    };
  },

  async upsertEmployeeBankDetails(
    companyId: string,
    userId: string,
    input: {
      bankName: string | null;
      accountHolderName: string | null;
      accountNumber: string | null;
      ifsc: string | null;
      pan: string | null;
      uan: string | null;
      verifiedBy: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;

    await database.query(
      `
        INSERT INTO employee_bank_details (
          id,
          company_id,
          user_id,
          bank_name,
          account_holder_name,
          account_number,
          ifsc,
          pan,
          uan,
          verified_at,
          verified_by,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          CASE WHEN $10::text IS NULL THEN NULL ELSE NOW() END,
          $10,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          bank_name = EXCLUDED.bank_name,
          account_holder_name = EXCLUDED.account_holder_name,
          account_number = EXCLUDED.account_number,
          ifsc = EXCLUDED.ifsc,
          pan = EXCLUDED.pan,
          uan = EXCLUDED.uan,
          verified_at = CASE
            WHEN EXCLUDED.verified_by IS NULL THEN NULL
            ELSE NOW()
          END,
          verified_by = EXCLUDED.verified_by,
          updated_at = NOW()
      `,
      [
        randomUUID(),
        companyId,
        userId,
        input.bankName,
        input.accountHolderName,
        input.accountNumber,
        input.ifsc,
        input.pan,
        input.uan,
        input.verifiedBy,
      ],
    );

    return this.findSelfBankDetails(companyId, userId, database);
  },

  async listSelfEducation(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeEducationRow>(
      `
        SELECT
          employee_education.id,
          employee_education.degree,
          employee_education.institution,
          employee_education.field_of_study AS "fieldOfStudy",
          employee_education.start_year AS "startYear",
          employee_education.end_year AS "endYear",
          employee_education.grade,
          employee_education.description,
          employee_education.created_at AS "createdAt",
          employee_education.updated_at AS "updatedAt"
        FROM employee_education
        WHERE employee_education.company_id = $1
          AND employee_education.user_id = $2
        ORDER BY
          employee_education.end_year DESC NULLS LAST,
          employee_education.start_year DESC NULLS LAST,
          employee_education.updated_at DESC
      `,
      [companyId, userId],
    );

    return result.rows.map(mapEmployeeEducation);
  },

  async createEducation(
    companyId: string,
    userId: string,
    input: {
      degree: string;
      institution: string;
      fieldOfStudy: string | null;
      startYear: number | null;
      endYear: number | null;
      grade: string | null;
      description: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeEducationRow>(
      `
        INSERT INTO employee_education (
          id,
          company_id,
          user_id,
          degree,
          institution,
          field_of_study,
          start_year,
          end_year,
          grade,
          description,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          degree,
          institution,
          field_of_study AS "fieldOfStudy",
          start_year AS "startYear",
          end_year AS "endYear",
          grade,
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        companyId,
        userId,
        input.degree,
        input.institution,
        input.fieldOfStudy,
        input.startYear,
        input.endYear,
        input.grade,
        input.description,
      ],
    );

    return result.rows[0] ? mapEmployeeEducation(result.rows[0]) : null;
  },

  async updateEducation(
    companyId: string,
    userId: string,
    educationId: string,
    input: {
      degree: string;
      institution: string;
      fieldOfStudy: string | null;
      startYear: number | null;
      endYear: number | null;
      grade: string | null;
      description: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeEducationRow>(
      `
        UPDATE employee_education
        SET
          degree = $4,
          institution = $5,
          field_of_study = $6,
          start_year = $7,
          end_year = $8,
          grade = $9,
          description = $10,
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          degree,
          institution,
          field_of_study AS "fieldOfStudy",
          start_year AS "startYear",
          end_year AS "endYear",
          grade,
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        userId,
        educationId,
        input.degree,
        input.institution,
        input.fieldOfStudy,
        input.startYear,
        input.endYear,
        input.grade,
        input.description,
      ],
    );

    return result.rows[0] ? mapEmployeeEducation(result.rows[0]) : null;
  },

  async deleteEducation(
    companyId: string,
    userId: string,
    educationId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{ id: string }>(
      `
        DELETE FROM employee_education
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING id
      `,
      [companyId, userId, educationId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async listSelfSkills(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSkillRow>(
      `
        SELECT
          employee_skills.id,
          employee_skills.name,
          employee_skills.category,
          employee_skills.proficiency,
          employee_skills.created_at AS "createdAt",
          employee_skills.updated_at AS "updatedAt"
        FROM employee_skills
        WHERE employee_skills.company_id = $1
          AND employee_skills.user_id = $2
        ORDER BY employee_skills.updated_at DESC
      `,
      [companyId, userId],
    );

    return result.rows.map(mapEmployeeSkill);
  },

  async createSkill(
    companyId: string,
    userId: string,
    input: {
      name: string;
      category: string | null;
      proficiency: number | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSkillRow>(
      `
        INSERT INTO employee_skills (
          id,
          company_id,
          user_id,
          name,
          category,
          proficiency,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          name,
          category,
          proficiency,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [randomUUID(), companyId, userId, input.name, input.category, input.proficiency],
    );

    return result.rows[0] ? mapEmployeeSkill(result.rows[0]) : null;
  },

  async updateSkill(
    companyId: string,
    userId: string,
    skillId: string,
    input: {
      name: string;
      category: string | null;
      proficiency: number | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeSkillRow>(
      `
        UPDATE employee_skills
        SET
          name = $4,
          category = $5,
          proficiency = $6,
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          name,
          category,
          proficiency,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [companyId, userId, skillId, input.name, input.category, input.proficiency],
    );

    return result.rows[0] ? mapEmployeeSkill(result.rows[0]) : null;
  },

  async deleteSkill(
    companyId: string,
    userId: string,
    skillId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{ id: string }>(
      `
        DELETE FROM employee_skills
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING id
      `,
      [companyId, userId, skillId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async listSelfAchievements(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeAchievementRow>(
      `
        SELECT
          employee_achievements.id,
          employee_achievements.title,
          employee_achievements.issuer,
          employee_achievements.achieved_at AS "achievedAt",
          employee_achievements.credential_url AS "credentialUrl",
          employee_achievements.description,
          employee_achievements.created_at AS "createdAt",
          employee_achievements.updated_at AS "updatedAt"
        FROM employee_achievements
        WHERE employee_achievements.company_id = $1
          AND employee_achievements.user_id = $2
        ORDER BY
          employee_achievements.achieved_at DESC NULLS LAST,
          employee_achievements.updated_at DESC
      `,
      [companyId, userId],
    );

    return result.rows.map(mapEmployeeAchievement);
  },

  async createAchievement(
    companyId: string,
    userId: string,
    input: {
      title: string;
      issuer: string | null;
      achievedAt: string | null;
      credentialUrl: string | null;
      description: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeAchievementRow>(
      `
        INSERT INTO employee_achievements (
          id,
          company_id,
          user_id,
          title,
          issuer,
          achieved_at,
          credential_url,
          description,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          title,
          issuer,
          achieved_at AS "achievedAt",
          credential_url AS "credentialUrl",
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        companyId,
        userId,
        input.title,
        input.issuer,
        input.achievedAt,
        input.credentialUrl,
        input.description,
      ],
    );

    return result.rows[0] ? mapEmployeeAchievement(result.rows[0]) : null;
  },

  async updateAchievement(
    companyId: string,
    userId: string,
    achievementId: string,
    input: {
      title: string;
      issuer: string | null;
      achievedAt: string | null;
      credentialUrl: string | null;
      description: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<EmployeeAchievementRow>(
      `
        UPDATE employee_achievements
        SET
          title = $4,
          issuer = $5,
          achieved_at = $6,
          credential_url = $7,
          description = $8,
          updated_at = NOW()
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          title,
          issuer,
          achieved_at AS "achievedAt",
          credential_url AS "credentialUrl",
          description,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        userId,
        achievementId,
        input.title,
        input.issuer,
        input.achievedAt,
        input.credentialUrl,
        input.description,
      ],
    );

    return result.rows[0] ? mapEmployeeAchievement(result.rows[0]) : null;
  },

  async deleteAchievement(
    companyId: string,
    userId: string,
    achievementId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{ id: string }>(
      `
        DELETE FROM employee_achievements
        WHERE company_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING id
      `,
      [companyId, userId, achievementId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async listSelfProfileChangeRequests(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<ProfileChangeRequestRow>(
      `${profileChangeRequestSelect}
        AND requests.user_id = $2
      ORDER BY requests.requested_at DESC`,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapProfileChangeRequest(row))
      .filter((row): row is ProfileChangeRequestRecord => row !== null);
  },

  async listCompanyProfileChangeRequests(
    companyId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<ProfileChangeRequestRow>(
      `${profileChangeRequestSelect}
      ORDER BY
        CASE requests.status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END,
        requests.requested_at DESC`,
      [companyId],
    );

    return result.rows
      .map((row) => mapProfileChangeRequest(row))
      .filter((row): row is ProfileChangeRequestRecord => row !== null);
  },

  async findProfileChangeRequestById(
    companyId: string,
    requestId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<ProfileChangeRequestRow>(
      `${profileChangeRequestSelect}
        AND requests.id = $2
      LIMIT 1`,
      [companyId, requestId],
    );

    return mapProfileChangeRequest(result.rows[0]);
  },

  async findPendingProfileChangeRequest(
    companyId: string,
    userId: string,
    requestType: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{ id: string }>(
      `
        SELECT id
        FROM profile_change_requests
        WHERE company_id = $1
          AND user_id = $2
          AND request_type = $3
          AND status = 'pending'
        LIMIT 1
      `,
      [companyId, userId, requestType],
    );

    return Boolean(result.rows[0]?.id);
  },

  async createProfileChangeRequest(
    companyId: string,
    userId: string,
    input: {
      requestType: string;
      requestedChanges: Record<string, unknown>;
      reason: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const createdResult = await database.query<{ id: string }>(
      `
        INSERT INTO profile_change_requests (
          id,
          company_id,
          user_id,
          request_type,
          status,
          requested_changes,
          reason,
          requested_at,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          'pending',
          $5::jsonb,
          $6,
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        randomUUID(),
        companyId,
        userId,
        input.requestType,
        JSON.stringify(input.requestedChanges),
        input.reason,
      ],
    );

    const requestId = createdResult.rows[0]?.id;

    if (!requestId) {
      return null;
    }

    return this.findProfileChangeRequestById(companyId, requestId, database);
  },

  async reviewProfileChangeRequest(
    companyId: string,
    requestId: string,
    input: {
      status: "approved" | "rejected";
      reviewNotes: string | null;
      reviewedBy: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<ProfileChangeRequestRow>(
      `
        WITH updated AS (
          UPDATE profile_change_requests
          SET
            status = $3,
            review_notes = $4,
            reviewed_by = $5,
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE company_id = $1
            AND id = $2
            AND status = 'pending'
          RETURNING *
        )
        SELECT
          updated.id,
          updated.user_id AS "userId",
          updated.request_type AS "requestType",
          updated.status,
          updated.requested_changes AS "requestedChanges",
          updated.reason,
          updated.review_notes AS "reviewNotes",
          updated.requested_at AS "requestedAt",
          updated.reviewed_at AS "reviewedAt",
          updated.created_at AS "createdAt",
          updated.updated_at AS "updatedAt",
          employee.id AS "employeeId",
          employee.full_name AS "employeeFullName",
          employee.email AS "employeeEmail",
          employee.role AS "employeeRole",
          employee.is_active AS "employeeIsActive",
          employee.created_at AS "employeeCreatedAt",
          employee.updated_at AS "employeeUpdatedAt",
          employee_departments.id AS "employeeDepartmentId",
          employee_departments.name AS "employeeDepartmentName",
          employee_departments.code AS "employeeDepartmentCode",
          employee_designations.id AS "employeeDesignationId",
          employee_designations.title AS "employeeDesignationTitle",
          employee_designations.code AS "employeeDesignationCode",
          employee_designation_departments.id AS "employeeDesignationDepartmentId",
          employee_designation_departments.name AS "employeeDesignationDepartmentName",
          employee_designation_departments.code AS "employeeDesignationDepartmentCode",
          reviewer.id AS "reviewedById",
          reviewer.full_name AS "reviewedByFullName",
          reviewer.email AS "reviewedByEmail",
          reviewer.role AS "reviewedByRole"
        FROM updated
        JOIN users AS employee
          ON employee.id = updated.user_id
          AND employee.company_id = $1
        LEFT JOIN departments AS employee_departments
          ON employee_departments.id = employee.department_id
          AND employee_departments.company_id = $1
        LEFT JOIN designations AS employee_designations
          ON employee_designations.id = employee.designation_id
          AND employee_designations.company_id = $1
        LEFT JOIN departments AS employee_designation_departments
          ON employee_designation_departments.id = employee_designations.department_id
          AND employee_designation_departments.company_id = $1
        LEFT JOIN users AS reviewer
          ON reviewer.id = updated.reviewed_by
      `,
      [
        companyId,
        requestId,
        input.status,
        input.reviewNotes,
        input.reviewedBy,
      ],
    );

    return mapProfileChangeRequest(result.rows[0]);
  },

  async updateApprovedJobInformation(
    companyId: string,
    userId: string,
    input: {
      employeeId: string | null;
      reportingManagerId: string | null;
      workLocation: string | null;
      employmentType: EmployeeSelfProfile["employmentType"];
    },
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    await database.query(
      `
        UPDATE users
        SET
          employee_id = $3,
          reporting_manager_id = $4,
          work_location = $5,
          employment_type = $6,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
          AND role = 'employee'
      `,
      [
        companyId,
        userId,
        input.employeeId,
        input.reportingManagerId,
        input.workLocation,
        input.employmentType,
      ],
    );
  },

  async findCompanyUserActorSummary(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const database = executor ?? defaultExecutor;
    const result = await database.query<{
      id: string;
      fullName: string;
      email: string;
      role: string;
    }>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role
        FROM users
        WHERE users.company_id = $1
          AND users.id = $2
        LIMIT 1
      `,
      [companyId, userId],
    );

    return mapActorSummary({
      id: result.rows[0]?.id ?? null,
      fullName: result.rows[0]?.fullName ?? null,
      email: result.rows[0]?.email ?? null,
      role: result.rows[0]?.role ?? null,
    });
  },
};
