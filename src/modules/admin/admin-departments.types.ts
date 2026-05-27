import type { DepartmentDirectoryView } from "../departments/departments.types.js";

export type AdminDepartmentsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  summary: {
    totalDepartments: number;
    totalEmployees: number;
    activeDepartments: number;
    inactiveDepartments: number;
    largestDepartment: {
      id: string;
      name: string;
      employeeCount: number;
    } | null;
  };
  departments: DepartmentDirectoryView[];
};

export type AdminDepartmentsServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: 403 | 404;
      message: string;
    };
