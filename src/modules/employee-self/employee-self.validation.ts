import type { ValidationResult } from "../auth/auth.types.js";
import {
  isEmployeeProfileEmploymentType,
  isEmployeeProfileGender,
  isEmployeeProfileMaritalStatus,
  isProfileChangeRequestType,
  type CreateEmployeeAchievementRequest,
  type CreateEmployeeEducationRequest,
  type CreateEmployeeSkillRequest,
  type CreateProfileChangeRequestRequest,
  type ReviewProfileChangeRequestRequest,
  type UpdateEmployeeSelfBankDetailsRequest,
  type UpdateEmployeeAchievementRequest,
  type UpdateEmployeeEducationRequest,
  type UpdateEmployeeSelfProfileRequest,
  type UpdateEmployeeSelfSettingsRequest,
  type UpdateEmployeeSkillRequest,
} from "./employee-self.types.js";

export const MAX_PROFILE_PHOTO_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

const editableFieldKeys = [
  "phone",
  "personalEmail",
  "emergencyContactName",
  "emergencyContactPhone",
  "address",
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "bloodGroup",
  "nationality",
  "languages",
  "bio",
  "linkedinUrl",
  "githubUrl",
] as const;

const settingsFieldKeys = [
  "permanentAddress",
  "emailNotifications",
  "marketingEmails",
  "attendanceAlerts",
  "leaveUpdates",
  "announcementAlerts",
  "payrollNotifications",
] as const;

const bankDetailFieldKeys = [
  "bankName",
  "accountHolderName",
  "accountNumber",
  "ifsc",
  "pan",
  "uan",
] as const;

function fail<T>(...errors: string[]): ValidationResult<T> {
  return {
    success: false,
    errors,
  };
}

function success<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

function normalizeOptionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  return undefined;
}

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOptionalStringArray(value: unknown) {
  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
}

function isBankAccountNumber(value: string) {
  return /^[0-9 ]{6,34}$/.test(value);
}

function isIfscCode(value: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(value);
}

function isPanCode(value: string) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(value);
}

function isUanCode(value: string) {
  return /^[0-9]{12}$/.test(value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeBloodGroup(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value.toUpperCase();
}

function validateYear(value: number | null | undefined) {
  if (value === undefined || value === null) {
    return true;
  }

  return value >= 1900 && value <= 2100;
}

function readFileExtension(fileName: string | null) {
  if (!fileName) {
    return null;
  }

  const extension = fileName.split(".").at(-1)?.trim().toLowerCase() ?? "";
  return extension || null;
}

function readFileSignature(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return "exe";
  }

  return null;
}

export type UploadedProfilePhotoCandidate = {
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  buffer: Buffer;
};

export function validateUploadedProfilePhoto(
  file?: UploadedProfilePhotoCandidate | null,
): ValidationResult<{
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}> {
  if (!file?.buffer || file.buffer.length === 0) {
    return fail("Attach a JPG or PNG profile photo before uploading.");
  }

  const fileName = normalizeOptionalString(file.originalName) ?? null;
  const extension = readFileExtension(fileName);
  const normalizedMime = normalizeOptionalString(file.mimeType)?.toLowerCase() ?? null;
  const signature = readFileSignature(file.buffer);
  const errors: string[] = [];

  if (!fileName) {
    errors.push("The uploaded profile photo file name is missing.");
  }

  if (file.sizeBytes > MAX_PROFILE_PHOTO_UPLOAD_SIZE_BYTES) {
    errors.push("Profile photos larger than 2 MB are not supported.");
  }

  if (!extension || !["jpg", "jpeg", "png"].includes(extension)) {
    errors.push("Only JPG and PNG profile photos are supported.");
  }

  if (
    normalizedMime &&
    !["image/jpeg", "image/pjpeg", "image/png"].includes(normalizedMime)
  ) {
    errors.push("Only JPG and PNG profile photos are supported.");
  }

  if (signature === "exe") {
    errors.push("Executable files are not allowed.");
  }

  if (
    (extension === "png" && signature !== "png") ||
    ((extension === "jpg" || extension === "jpeg") && signature !== "jpeg")
  ) {
    errors.push("The uploaded file content does not match the selected image type.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    fileName: fileName ?? "profile-photo",
    mimeType: extension === "png" ? "image/png" : "image/jpeg",
    buffer: file.buffer,
    sizeBytes: file.sizeBytes,
  });
}

export function validateUpdateEmployeeSelfProfilePayload(
  input: unknown,
): ValidationResult<UpdateEmployeeSelfProfileRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Profile payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one editable profile field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !editableFieldKeys.includes(key as (typeof editableFieldKeys)[number]),
  );

  if (invalidKeys.length > 0) {
    return fail("The profile payload contains fields that are not employee-editable.");
  }

  const errors: string[] = [];
  const data: UpdateEmployeeSelfProfileRequest = {};

  if ("phone" in payload) {
    const phone = normalizeOptionalString(payload.phone);

    if (phone === undefined) {
      errors.push("Phone must be a string value.");
    } else if (phone && !isPhoneNumber(phone)) {
      errors.push(
        "Phone must contain 7 to 20 characters using digits and standard phone symbols only.",
      );
    } else {
      data.phone = phone;
    }
  }

  if ("personalEmail" in payload) {
    const personalEmail = normalizeOptionalString(payload.personalEmail);

    if (personalEmail === undefined) {
      errors.push("Personal email must be a string value.");
    } else if (personalEmail && !isEmail(personalEmail)) {
      errors.push("A valid personal email address is required.");
    } else {
      data.personalEmail = personalEmail?.toLowerCase() ?? null;
    }
  }

  if ("emergencyContactName" in payload) {
    const emergencyContactName = normalizeOptionalString(
      payload.emergencyContactName,
    );

    if (emergencyContactName === undefined) {
      errors.push("Emergency contact name must be a string value.");
    } else if (
      emergencyContactName &&
      (emergencyContactName.length < 2 || emergencyContactName.length > 120)
    ) {
      errors.push(
        "Emergency contact name must be between 2 and 120 characters long.",
      );
    } else {
      data.emergencyContactName = emergencyContactName;
    }
  }

  if ("emergencyContactPhone" in payload) {
    const emergencyContactPhone = normalizeOptionalString(
      payload.emergencyContactPhone,
    );

    if (emergencyContactPhone === undefined) {
      errors.push("Emergency contact phone must be a string value.");
    } else if (emergencyContactPhone && !isPhoneNumber(emergencyContactPhone)) {
      errors.push(
        "Emergency contact phone must contain 7 to 20 characters using digits and standard phone symbols only.",
      );
    } else {
      data.emergencyContactPhone = emergencyContactPhone;
    }
  }

  if ("address" in payload) {
    const address = normalizeOptionalString(payload.address);

    if (address === undefined) {
      errors.push("Address must be a string value.");
    } else if (address && (address.length < 5 || address.length > 500)) {
      errors.push("Address must be between 5 and 500 characters long.");
    } else {
      data.address = address;
    }
  }

  if ("dateOfBirth" in payload) {
    const dateOfBirth = normalizeOptionalString(payload.dateOfBirth);

    if (dateOfBirth === undefined) {
      errors.push("Date of birth must be a string value.");
    } else if (dateOfBirth && !isIsoDate(dateOfBirth)) {
      errors.push("Date of birth must be a valid YYYY-MM-DD date.");
    } else {
      data.dateOfBirth = dateOfBirth;
    }
  }

  if ("gender" in payload) {
    const gender = normalizeOptionalString(payload.gender);

    if (gender === undefined) {
      errors.push("Gender must be a string value.");
    } else if (gender !== null && !isEmployeeProfileGender(gender)) {
      errors.push("Gender selection is invalid.");
    } else {
      data.gender = gender;
    }
  }

  if ("maritalStatus" in payload) {
    const maritalStatus = normalizeOptionalString(payload.maritalStatus);

    if (maritalStatus === undefined) {
      errors.push("Marital status must be a string value.");
    } else if (
      maritalStatus !== null &&
      !isEmployeeProfileMaritalStatus(maritalStatus)
    ) {
      errors.push("Marital status selection is invalid.");
    } else {
      data.maritalStatus = maritalStatus;
    }
  }

  if ("bloodGroup" in payload) {
    const bloodGroup = normalizeBloodGroup(
      normalizeOptionalString(payload.bloodGroup),
    );

    if (bloodGroup === undefined) {
      errors.push("Blood group must be a string value.");
    } else if (
      bloodGroup &&
      !/^(A|B|AB|O)[+-]$/i.test(bloodGroup)
    ) {
      errors.push("Blood group must be one of A+, A-, B+, B-, AB+, AB-, O+, or O-.");
    } else {
      data.bloodGroup = bloodGroup;
    }
  }

  if ("nationality" in payload) {
    const nationality = normalizeOptionalString(payload.nationality);

    if (nationality === undefined) {
      errors.push("Nationality must be a string value.");
    } else if (nationality && (nationality.length < 2 || nationality.length > 120)) {
      errors.push("Nationality must be between 2 and 120 characters long.");
    } else {
      data.nationality = nationality;
    }
  }

  if ("languages" in payload) {
    const languages = normalizeOptionalStringArray(payload.languages);

    if (languages === undefined) {
      errors.push("Languages must be provided as an array of strings.");
    } else if (languages.some((language) => language.length > 80)) {
      errors.push("Each language must be 80 characters or fewer.");
    } else if (languages.length > 20) {
      errors.push("No more than 20 languages can be saved.");
    } else {
      data.languages = languages;
    }
  }

  if ("bio" in payload) {
    const bio = normalizeOptionalString(payload.bio);

    if (bio === undefined) {
      errors.push("Bio must be a string value.");
    } else if (bio && bio.length > 2000) {
      errors.push("Bio must be 2000 characters or fewer.");
    } else {
      data.bio = bio;
    }
  }

  if ("linkedinUrl" in payload) {
    const linkedinUrl = normalizeOptionalString(payload.linkedinUrl);

    if (linkedinUrl === undefined) {
      errors.push("LinkedIn URL must be a string value.");
    } else if (linkedinUrl && !isHttpUrl(linkedinUrl)) {
      errors.push("LinkedIn URL must be a valid HTTP or HTTPS URL.");
    } else {
      data.linkedinUrl = linkedinUrl;
    }
  }

  if ("githubUrl" in payload) {
    const githubUrl = normalizeOptionalString(payload.githubUrl);

    if (githubUrl === undefined) {
      errors.push("GitHub URL must be a string value.");
    } else if (githubUrl && !isHttpUrl(githubUrl)) {
      errors.push("GitHub URL must be a valid HTTP or HTTPS URL.");
    } else {
      data.githubUrl = githubUrl;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateUpdateEmployeeSelfSettingsPayload(
  input: unknown,
): ValidationResult<UpdateEmployeeSelfSettingsRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Settings payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one editable settings field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !settingsFieldKeys.includes(key as (typeof settingsFieldKeys)[number]),
  );

  if (invalidKeys.length > 0) {
    return fail(
      "Only permanentAddress, emailNotifications, marketingEmails, attendanceAlerts, leaveUpdates, announcementAlerts, and payrollNotifications can be updated here.",
    );
  }

  const errors: string[] = [];
  const data: UpdateEmployeeSelfSettingsRequest = {};

  if ("permanentAddress" in payload) {
    const permanentAddress = normalizeOptionalString(payload.permanentAddress);

    if (permanentAddress === undefined) {
      errors.push("Permanent address must be a string value.");
    } else if (
      permanentAddress &&
      (permanentAddress.length < 5 || permanentAddress.length > 500)
    ) {
      errors.push("Permanent address must be between 5 and 500 characters long.");
    } else {
      data.permanentAddress = permanentAddress;
    }
  }

  const booleanFields: Array<
    Exclude<keyof UpdateEmployeeSelfSettingsRequest, "permanentAddress">
  > = [
    "emailNotifications",
    "marketingEmails",
    "attendanceAlerts",
    "leaveUpdates",
    "announcementAlerts",
    "payrollNotifications",
  ];

  for (const field of booleanFields) {
    if (!(field in payload)) {
      continue;
    }

    const normalized = normalizeOptionalBoolean(payload[field]);

    if (normalized === undefined) {
      errors.push(`${field} must be a boolean value.`);
      continue;
    }

    data[field] = normalized;
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateUpdateEmployeeSelfBankDetailsPayload(
  input: unknown,
): ValidationResult<UpdateEmployeeSelfBankDetailsRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Bank details payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one bank detail field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) =>
      !bankDetailFieldKeys.includes(key as (typeof bankDetailFieldKeys)[number]),
  );

  if (invalidKeys.length > 0) {
    return fail(
      "Only bankName, accountHolderName, accountNumber, ifsc, pan, and uan can be updated here.",
    );
  }

  const errors: string[] = [];
  const data: UpdateEmployeeSelfBankDetailsRequest = {};

  if ("bankName" in payload) {
    const bankName = normalizeOptionalString(payload.bankName);

    if (bankName === undefined) {
      errors.push("Bank name must be a string value.");
    } else if (bankName !== null && bankName.length > 160) {
      errors.push("Bank name must be 160 characters or fewer.");
    } else {
      data.bankName = bankName;
    }
  }

  if ("accountHolderName" in payload) {
    const accountHolderName = normalizeOptionalString(payload.accountHolderName);

    if (accountHolderName === undefined) {
      errors.push("Account holder name must be a string value.");
    } else if (
      accountHolderName !== null &&
      (accountHolderName.length < 2 || accountHolderName.length > 160)
    ) {
      errors.push("Account holder name must be between 2 and 160 characters long.");
    } else {
      data.accountHolderName = accountHolderName;
    }
  }

  if ("accountNumber" in payload) {
    const accountNumber = normalizeOptionalString(payload.accountNumber);

    if (accountNumber === undefined) {
      errors.push("Account number must be a string value.");
    } else if (accountNumber !== null && !isBankAccountNumber(accountNumber)) {
      errors.push("Account number must contain 6 to 34 digits.");
    } else {
      data.accountNumber = accountNumber?.replace(/\s+/g, "") ?? null;
    }
  }

  if ("ifsc" in payload) {
    const ifsc = normalizeOptionalString(payload.ifsc);

    if (ifsc === undefined) {
      errors.push("IFSC code must be a string value.");
    } else if (ifsc !== null && !isIfscCode(ifsc)) {
      errors.push("IFSC code must be a valid 11-character bank code.");
    } else {
      data.ifsc = ifsc?.toUpperCase() ?? null;
    }
  }

  if ("pan" in payload) {
    const pan = normalizeOptionalString(payload.pan);

    if (pan === undefined) {
      errors.push("PAN must be a string value.");
    } else if (pan !== null && !isPanCode(pan)) {
      errors.push("PAN must be a valid 10-character permanent account number.");
    } else {
      data.pan = pan?.toUpperCase() ?? null;
    }
  }

  if ("uan" in payload) {
    const uan = normalizeOptionalString(payload.uan);

    if (uan === undefined) {
      errors.push("UAN must be a string value.");
    } else if (uan !== null && !isUanCode(uan)) {
      errors.push("UAN must be a valid 12-digit number.");
    } else {
      data.uan = uan;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateCreateEmployeeEducationPayload(
  input: unknown,
): ValidationResult<CreateEmployeeEducationRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Education payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const degree = normalizeOptionalString(payload.degree);
  const institution = normalizeOptionalString(payload.institution);
  const fieldOfStudy = normalizeOptionalString(payload.fieldOfStudy);
  const startYear = normalizeOptionalNumber(payload.startYear);
  const endYear = normalizeOptionalNumber(payload.endYear);
  const grade = normalizeOptionalString(payload.grade);
  const description = normalizeOptionalString(payload.description);
  const errors: string[] = [];

  if (!degree) {
    errors.push("Degree is required.");
  } else if (degree.length > 160) {
    errors.push("Degree must be 160 characters or fewer.");
  }

  if (!institution) {
    errors.push("Institution is required.");
  } else if (institution.length > 160) {
    errors.push("Institution must be 160 characters or fewer.");
  }

  if (fieldOfStudy && fieldOfStudy.length > 160) {
    errors.push("Field of study must be 160 characters or fewer.");
  }

  if (!validateYear(startYear)) {
    errors.push("Start year must be between 1900 and 2100.");
  }

  if (!validateYear(endYear)) {
    errors.push("End year must be between 1900 and 2100.");
  }

  if (startYear !== undefined && endYear !== undefined && startYear !== null && endYear !== null && endYear < startYear) {
    errors.push("End year cannot be earlier than start year.");
  }

  if (grade && grade.length > 60) {
    errors.push("Grade must be 60 characters or fewer.");
  }

  if (description && description.length > 1000) {
    errors.push("Education description must be 1000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    degree: degree as string,
    institution: institution as string,
    fieldOfStudy,
    startYear: startYear ?? null,
    endYear: endYear ?? null,
    grade,
    description,
  });
}

export function validateUpdateEmployeeEducationPayload(
  input: unknown,
): ValidationResult<UpdateEmployeeEducationRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Education update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one education field must be provided.");
  }

  const degree = normalizeOptionalString(payload.degree);
  const institution = normalizeOptionalString(payload.institution);
  const fieldOfStudy = normalizeOptionalString(payload.fieldOfStudy);
  const startYear = normalizeOptionalNumber(payload.startYear);
  const endYear = normalizeOptionalNumber(payload.endYear);
  const grade = normalizeOptionalString(payload.grade);
  const description = normalizeOptionalString(payload.description);
  const errors: string[] = [];
  const data: UpdateEmployeeEducationRequest = {};

  if ("degree" in payload) {
    if (degree === undefined) {
      errors.push("Degree must be a string value.");
    } else if (degree !== null && degree.length > 160) {
      errors.push("Degree must be 160 characters or fewer.");
    } else {
      data.degree = degree;
    }
  }

  if ("institution" in payload) {
    if (institution === undefined) {
      errors.push("Institution must be a string value.");
    } else if (institution !== null && institution.length > 160) {
      errors.push("Institution must be 160 characters or fewer.");
    } else {
      data.institution = institution;
    }
  }

  if ("fieldOfStudy" in payload) {
    if (fieldOfStudy === undefined) {
      errors.push("Field of study must be a string value.");
    } else if (fieldOfStudy !== null && fieldOfStudy.length > 160) {
      errors.push("Field of study must be 160 characters or fewer.");
    } else {
      data.fieldOfStudy = fieldOfStudy;
    }
  }

  if ("startYear" in payload) {
    if (startYear === undefined || !validateYear(startYear)) {
      errors.push("Start year must be between 1900 and 2100.");
    } else {
      data.startYear = startYear;
    }
  }

  if ("endYear" in payload) {
    if (endYear === undefined || !validateYear(endYear)) {
      errors.push("End year must be between 1900 and 2100.");
    } else {
      data.endYear = endYear;
    }
  }

  const nextStartYear = data.startYear ?? startYear ?? null;
  const nextEndYear = data.endYear ?? endYear ?? null;

  if (
    nextStartYear !== undefined &&
    nextEndYear !== undefined &&
    nextStartYear !== null &&
    nextEndYear !== null &&
    nextEndYear < nextStartYear
  ) {
    errors.push("End year cannot be earlier than start year.");
  }

  if ("grade" in payload) {
    if (grade === undefined) {
      errors.push("Grade must be a string value.");
    } else if (grade !== null && grade.length > 60) {
      errors.push("Grade must be 60 characters or fewer.");
    } else {
      data.grade = grade;
    }
  }

  if ("description" in payload) {
    if (description === undefined) {
      errors.push("Description must be a string value.");
    } else if (description !== null && description.length > 1000) {
      errors.push("Education description must be 1000 characters or fewer.");
    } else {
      data.description = description;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateCreateEmployeeSkillPayload(
  input: unknown,
): ValidationResult<CreateEmployeeSkillRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Skill payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const name = normalizeOptionalString(payload.name);
  const category = normalizeOptionalString(payload.category);
  const proficiency = normalizeOptionalNumber(payload.proficiency);
  const errors: string[] = [];

  if (!name) {
    errors.push("Skill name is required.");
  } else if (name.length > 120) {
    errors.push("Skill name must be 120 characters or fewer.");
  }

  if (category && category.length > 120) {
    errors.push("Skill category must be 120 characters or fewer.");
  }

  if (
    proficiency !== undefined &&
    proficiency !== null &&
    (proficiency < 0 || proficiency > 100)
  ) {
    errors.push("Skill proficiency must be between 0 and 100.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    name: name as string,
    category,
    proficiency: proficiency ?? null,
  });
}

export function validateUpdateEmployeeSkillPayload(
  input: unknown,
): ValidationResult<UpdateEmployeeSkillRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Skill update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one skill field must be provided.");
  }

  const name = normalizeOptionalString(payload.name);
  const category = normalizeOptionalString(payload.category);
  const proficiency = normalizeOptionalNumber(payload.proficiency);
  const errors: string[] = [];
  const data: UpdateEmployeeSkillRequest = {};

  if ("name" in payload) {
    if (name === undefined) {
      errors.push("Skill name must be a string value.");
    } else if (name !== null && name.length > 120) {
      errors.push("Skill name must be 120 characters or fewer.");
    } else {
      data.name = name;
    }
  }

  if ("category" in payload) {
    if (category === undefined) {
      errors.push("Skill category must be a string value.");
    } else if (category !== null && category.length > 120) {
      errors.push("Skill category must be 120 characters or fewer.");
    } else {
      data.category = category;
    }
  }

  if ("proficiency" in payload) {
    if (
      proficiency === undefined ||
      (proficiency !== null && (proficiency < 0 || proficiency > 100))
    ) {
      errors.push("Skill proficiency must be between 0 and 100.");
    } else {
      data.proficiency = proficiency;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateCreateEmployeeAchievementPayload(
  input: unknown,
): ValidationResult<CreateEmployeeAchievementRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Achievement payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const title = normalizeOptionalString(payload.title);
  const issuer = normalizeOptionalString(payload.issuer);
  const achievedAt = normalizeOptionalString(payload.achievedAt);
  const credentialUrl = normalizeOptionalString(payload.credentialUrl);
  const description = normalizeOptionalString(payload.description);
  const errors: string[] = [];

  if (!title) {
    errors.push("Achievement title is required.");
  } else if (title.length > 160) {
    errors.push("Achievement title must be 160 characters or fewer.");
  }

  if (issuer && issuer.length > 160) {
    errors.push("Achievement issuer must be 160 characters or fewer.");
  }

  if (achievedAt && !isIsoDate(achievedAt)) {
    errors.push("Achievement date must be a valid YYYY-MM-DD date.");
  }

  if (credentialUrl && !isHttpUrl(credentialUrl)) {
    errors.push("Credential URL must be a valid HTTP or HTTPS URL.");
  }

  if (description && description.length > 1000) {
    errors.push("Achievement description must be 1000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    title: title as string,
    issuer,
    achievedAt,
    credentialUrl,
    description,
  });
}

export function validateUpdateEmployeeAchievementPayload(
  input: unknown,
): ValidationResult<UpdateEmployeeAchievementRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Achievement update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one achievement field must be provided.");
  }

  const title = normalizeOptionalString(payload.title);
  const issuer = normalizeOptionalString(payload.issuer);
  const achievedAt = normalizeOptionalString(payload.achievedAt);
  const credentialUrl = normalizeOptionalString(payload.credentialUrl);
  const description = normalizeOptionalString(payload.description);
  const errors: string[] = [];
  const data: UpdateEmployeeAchievementRequest = {};

  if ("title" in payload) {
    if (title === undefined) {
      errors.push("Achievement title must be a string value.");
    } else if (title !== null && title.length > 160) {
      errors.push("Achievement title must be 160 characters or fewer.");
    } else {
      data.title = title;
    }
  }

  if ("issuer" in payload) {
    if (issuer === undefined) {
      errors.push("Achievement issuer must be a string value.");
    } else if (issuer !== null && issuer.length > 160) {
      errors.push("Achievement issuer must be 160 characters or fewer.");
    } else {
      data.issuer = issuer;
    }
  }

  if ("achievedAt" in payload) {
    if (achievedAt === undefined) {
      errors.push("Achievement date must be a string value.");
    } else if (achievedAt !== null && !isIsoDate(achievedAt)) {
      errors.push("Achievement date must be a valid YYYY-MM-DD date.");
    } else {
      data.achievedAt = achievedAt;
    }
  }

  if ("credentialUrl" in payload) {
    if (credentialUrl === undefined) {
      errors.push("Credential URL must be a string value.");
    } else if (credentialUrl !== null && !isHttpUrl(credentialUrl)) {
      errors.push("Credential URL must be a valid HTTP or HTTPS URL.");
    } else {
      data.credentialUrl = credentialUrl;
    }
  }

  if ("description" in payload) {
    if (description === undefined) {
      errors.push("Achievement description must be a string value.");
    } else if (description !== null && description.length > 1000) {
      errors.push("Achievement description must be 1000 characters or fewer.");
    } else {
      data.description = description;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

function normalizeRequestedChangeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function validateCreateProfileChangeRequestPayload(
  input: unknown,
): ValidationResult<CreateProfileChangeRequestRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Profile change request payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const requestType = normalizeOptionalString(payload.requestType);
  const requestedChanges = normalizeRequestedChangeObject(payload.requestedChanges);
  const reason = normalizeOptionalString(payload.reason);
  const errors: string[] = [];

  if (!requestType || !isProfileChangeRequestType(requestType)) {
    errors.push("Profile change request type is invalid.");
  }

  if (!requestedChanges || Object.keys(requestedChanges).length === 0) {
    errors.push("Requested changes are required.");
  }

  if (reason && reason.length > 1000) {
    errors.push("Reason must be 1000 characters or fewer.");
  }

  if (requestType === "bank-details" && requestedChanges) {
    const supportedKeys = new Set([
      "bankName",
      "accountHolderName",
      "accountNumber",
      "ifsc",
      "pan",
      "uan",
    ]);
    const invalidKeys = Object.keys(requestedChanges).filter(
      (key) => !supportedKeys.has(key),
    );

    if (invalidKeys.length > 0) {
      errors.push("Bank detail requests contain unsupported fields.");
    }

    for (const [key, value] of Object.entries(requestedChanges)) {
      if (value !== null && typeof value !== "string") {
        errors.push(`Bank detail field "${key}" must be a string or null.`);
      }
    }
  }

  if (requestType === "job-information" && requestedChanges) {
    const supportedKeys = new Set([
      "employeeId",
      "reportingManagerId",
      "workLocation",
      "employmentType",
    ]);
    const invalidKeys = Object.keys(requestedChanges).filter(
      (key) => !supportedKeys.has(key),
    );

    if (invalidKeys.length > 0) {
      errors.push("Job information requests contain unsupported fields.");
    }

    for (const [key, value] of Object.entries(requestedChanges)) {
      if (value !== null && typeof value !== "string") {
        errors.push(`Job information field "${key}" must be a string or null.`);
      }
    }

    const employmentType = normalizeOptionalString(requestedChanges.employmentType);

    if (
      employmentType !== undefined &&
      employmentType !== null &&
      !isEmployeeProfileEmploymentType(employmentType)
    ) {
      errors.push("Employment type must match a supported employee employment type.");
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    requestType: requestType as CreateProfileChangeRequestRequest["requestType"],
    requestedChanges: requestedChanges ?? {},
    reason,
  });
}

export function validateReviewProfileChangeRequestPayload(
  input: unknown,
): ValidationResult<ReviewProfileChangeRequestRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Profile change review payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const status = normalizeOptionalString(payload.status);
  const reviewNotes = normalizeOptionalString(payload.reviewNotes);
  const errors: string[] = [];

  if (!status || !["approved", "rejected"].includes(status)) {
    errors.push("Review status must be approved or rejected.");
  }

  if (reviewNotes && reviewNotes.length > 1000) {
    errors.push("Review notes must be 1000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    status: status as ReviewProfileChangeRequestRequest["status"],
    reviewNotes,
  });
}
