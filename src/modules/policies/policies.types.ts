import type { CompanyStatus } from "../companies/companies.types.js";

export const COMPANY_POLICY_TYPES = ["leave", "attendance"] as const;

export type CompanyPolicyType = (typeof COMPANY_POLICY_TYPES)[number];

export const COMPANY_POLICY_INPUT_TYPES = [
  "number",
  "toggle",
  "select",
] as const;

export type CompanyPolicyInputType = (typeof COMPANY_POLICY_INPUT_TYPES)[number];

export type CompanyPolicyValue = string | number | boolean;

export type CompanyPolicyOption = {
  label: string;
  value: CompanyPolicyValue;
};

export type CompanyPolicyDefinition = {
  type: CompanyPolicyType;
  key: string;
  label: string;
  description: string;
  inputType: CompanyPolicyInputType;
  defaultValue: CompanyPolicyValue;
  options?: CompanyPolicyOption[];
  min?: number;
  max?: number;
  step?: number;
};

export type CompanyPolicySectionDefinition = {
  type: CompanyPolicyType;
  label: string;
  description: string;
};

export const COMPANY_POLICY_SECTION_DEFINITIONS: readonly CompanyPolicySectionDefinition[] =
  [
    {
      type: "leave",
      label: "Leave Policies",
      description:
        "Company-configured leave rules. Supported rules are enforced in live leave workflows.",
    },
    {
      type: "attendance",
      label: "Attendance Policies",
      description:
        "Company-configured attendance rules. Supported rules are enforced or exposed as calculated attendance context.",
    },
  ];

export const COMPANY_POLICY_DEFINITIONS: readonly CompanyPolicyDefinition[] = [
  {
    type: "leave",
    key: "max_days_per_year",
    label: "Maximum Days Per Year",
    description:
      "Maximum leave days available to one employee in a calendar year.",
    inputType: "number",
    defaultValue: 24,
    min: 0,
    max: 365,
    step: 1,
  },
  {
    type: "leave",
    key: "allow_half_day",
    label: "Allow Half-Day Leave",
    description: "Allow half-day leave requests to be configured and submitted.",
    inputType: "toggle",
    defaultValue: true,
  },
  {
    type: "leave",
    key: "require_approval",
    label: "Require Approval",
    description:
      "Require the approval matrix before a leave request is finalized.",
    inputType: "toggle",
    defaultValue: true,
  },
  {
    type: "leave",
    key: "leave_reset_cycle",
    label: "Leave Reset Cycle",
    description: "Choose when the annual leave allowance resets.",
    inputType: "select",
    defaultValue: "calendar-year",
    options: [
      { label: "Calendar Year", value: "calendar-year" },
      { label: "Rolling 12 Months", value: "rolling-12-months" },
    ],
  },
  {
    type: "leave",
    key: "carry_forward_allowed",
    label: "Carry Forward Allowed",
    description:
      "Allow unused leave to be carried into the next leave cycle for this company.",
    inputType: "toggle",
    defaultValue: false,
  },
  {
    type: "leave",
    key: "max_carry_forward",
    label: "Maximum Carry Forward Days",
    description:
      "Maximum number of leave days an employee can carry forward into the next cycle.",
    inputType: "number",
    defaultValue: 0,
    min: 0,
    max: 365,
    step: 1,
  },
  {
    type: "leave",
    key: "sandwich_leave_rule",
    label: "Sandwich Leave Rule",
    description:
      "Count holidays and weekly offs between approved leave days as leave where applicable.",
    inputType: "toggle",
    defaultValue: false,
  },
  {
    type: "leave",
    key: "leave_without_pay_enabled",
    label: "Leave Without Pay",
    description:
      "Allow leave processing to continue when paid quota is exhausted and switch to leave without pay.",
    inputType: "toggle",
    defaultValue: true,
  },
  {
    type: "attendance",
    key: "late_threshold_minutes",
    label: "Late Threshold Minutes",
    description:
      "Minutes after the scheduled start time before attendance is considered late.",
    inputType: "number",
    defaultValue: 15,
    min: 0,
    max: 240,
    step: 1,
  },
  {
    type: "attendance",
    key: "allow_manual_entry",
    label: "Allow Manual Entry",
    description:
      "Allow attendance records to be entered manually by administrators.",
    inputType: "toggle",
    defaultValue: false,
  },
  {
    type: "attendance",
    key: "work_hours_per_day",
    label: "Work Hours Per Day",
    description:
      "Expected working hours used as the current planning baseline for attendance.",
    inputType: "number",
    defaultValue: 8,
    min: 1,
    max: 24,
    step: 0.5,
  },
  {
    type: "attendance",
    key: "attendance_rounding_mode",
    label: "Attendance Rounding Mode",
    description:
      "Choose the time rounding style that future attendance enforcement can use.",
    inputType: "select",
    defaultValue: "exact",
    options: [
      { label: "Exact", value: "exact" },
      { label: "Nearest 15 Minutes", value: "nearest-15-minutes" },
      { label: "Nearest 30 Minutes", value: "nearest-30-minutes" },
    ],
  },
] as const;

export type CompanyPolicyDefinitionMap = {
  [K in CompanyPolicyType]: Extract<
    (typeof COMPANY_POLICY_DEFINITIONS)[number],
    { type: K }
  >[];
};

export type CompanyPolicyField = CompanyPolicyDefinition & {
  id: string;
  companyId: string;
  value: CompanyPolicyValue;
  createdAt: string;
  updatedAt: string;
};

export type CompanyPolicySection = CompanyPolicySectionDefinition & {
  policies: CompanyPolicyField[];
};

export type PoliciesWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalPolicies: number;
    leavePolicies: number;
    attendancePolicies: number;
    lastUpdatedAt: string | null;
  };
  sections: CompanyPolicySection[];
};

export type UpdatePolicyItem = {
  type: CompanyPolicyType;
  key: string;
  value: CompanyPolicyValue;
};

export type UpdatePoliciesRequest = {
  policies: UpdatePolicyItem[];
};

export type PoliciesMutationResponse = {
  message: string;
  workspace: PoliciesWorkspaceResponse;
};

export type AttendanceRoundingMode =
  | "exact"
  | "nearest-15-minutes"
  | "nearest-30-minutes";

export type LeaveResetCycle = "calendar-year" | "rolling-12-months";

export type AttendancePolicySettings = {
  allowManualEntry: boolean;
  lateThresholdMinutes: number;
  workHoursPerDay: number;
  workHoursReferenceMinutes: number;
  attendanceRoundingMode: AttendanceRoundingMode;
};

export type LeavePolicySettings = {
  maxDaysPerYear: number;
  allowHalfDay: boolean;
  requireApproval: boolean;
  leaveResetCycle: LeaveResetCycle;
};

export type CompanyPolicySettings = {
  attendance: AttendancePolicySettings;
  leave: LeavePolicySettings;
};

export type PoliciesServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type PoliciesServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type PoliciesServiceResult<T> =
  | PoliciesServiceSuccess<T>
  | PoliciesServiceFailure;

export function isCompanyPolicyType(value: string): value is CompanyPolicyType {
  return COMPANY_POLICY_TYPES.includes(value as CompanyPolicyType);
}

export function isCompanyPolicyInputType(
  value: string,
): value is CompanyPolicyInputType {
  return COMPANY_POLICY_INPUT_TYPES.includes(value as CompanyPolicyInputType);
}

export function getCompanyPolicyDefinition(
  type: CompanyPolicyType,
  key: string,
) {
  return COMPANY_POLICY_DEFINITIONS.find(
    (definition) => definition.type === type && definition.key === key,
  );
}
