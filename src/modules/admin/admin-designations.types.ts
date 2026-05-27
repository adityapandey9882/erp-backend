import type { DepartmentView } from "../departments/departments.types.js";
import type { DesignationDirectoryView } from "../designations/designations.types.js";

export type AdminDesignationsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  summary: {
    totalDesignations: number;
    totalEmployees: number;
    departmentsWithDesignations: number;
    mostUsedDesignation: {
      id: string;
      title: string;
      employeeCount: number;
    } | null;
  };
  departments: DepartmentView[];
  designations: DesignationDirectoryView[];
};

export type AdminDesignationsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 403 | 404;
      message: string;
    };
