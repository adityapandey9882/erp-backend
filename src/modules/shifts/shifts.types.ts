import type { CompanyStatus } from "../companies/companies.types.js";
import type { CompanyUserProfile } from "../users/users.types.js";

export type ShiftView = {
  id: string;
  companyId: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShiftSummary = Pick<
  ShiftView,
  "id" | "name" | "startTime" | "endTime" | "graceMinutes" | "breakMinutes" | "isActive"
>;

export type ShiftWithAssignmentCount = ShiftView & {
  assignedEmployeeCount: number;
};

export type ShiftEmployeeSummary = Pick<
  CompanyUserProfile,
  | "id"
  | "fullName"
  | "email"
  | "role"
  | "status"
  | "department"
  | "designation"
>;

export type EmployeeShiftAssignmentView = {
  id: string;
  userId: string;
  shiftId: string;
  assignedAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee: ShiftEmployeeSummary;
  shift: ShiftView;
};

export type HrShiftWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    totalShifts: number;
    assignedEmployees: number;
    unassignedEmployees: number;
    activeEmployees: number;
  };
  shifts: ShiftWithAssignmentCount[];
  assignments: EmployeeShiftAssignmentView[];
  employees: ShiftEmployeeSummary[];
};

export type EmployeeShiftResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  profile: ShiftEmployeeSummary;
  assignment: Pick<
    EmployeeShiftAssignmentView,
    "id" | "assignedAt" | "effectiveFrom" | "effectiveTo"
  > | null;
  shift: ShiftView | null;
};

export type CreateShiftRequest = {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
};

export type UpdateShiftRequest = Partial<CreateShiftRequest>;

export type AssignShiftRequest = {
  userId: string;
  shiftId: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type ShiftMutationResponse = {
  message: string;
  shift: ShiftWithAssignmentCount;
};

export type ShiftAssignmentMutationResponse = {
  message: string;
  assignment: EmployeeShiftAssignmentView;
};

export type ShiftsServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type ShiftsServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type ShiftsServiceResult<T> =
  | ShiftsServiceSuccess<T>
  | ShiftsServiceFailure;
