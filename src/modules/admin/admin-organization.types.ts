import type { CompanyStatus } from "../companies/companies.types.js";
import type { DepartmentView } from "../departments/departments.types.js";
import type { DesignationView } from "../designations/designations.types.js";

export type AdminOrganizationWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    contactEmail: string;
    status: CompanyStatus;
  };
  summary: {
    totalDepartments: number;
    totalDesignations: number;
    departmentsWithDesignations: number;
    departmentsWithoutDesignations: number;
    mappedDesignations: number;
    unassignedDesignations: number;
  };
  departments: DepartmentView[];
  designations: DesignationView[];
};

export type DepartmentMutationResponse = {
  message: string;
  department: DepartmentView;
};

export type DesignationMutationResponse = {
  message: string;
  designation: DesignationView;
};

export type AdminOrganizationServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AdminOrganizationServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type AdminOrganizationServiceResult<T> =
  | AdminOrganizationServiceSuccess<T>
  | AdminOrganizationServiceFailure;
