export type DepartmentView = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  designationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentDirectoryEmployee = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  designationTitle: string | null;
  status: "active" | "inactive";
  profilePhotoUrl: string | null;
};

export type DepartmentDirectoryHead = DepartmentDirectoryEmployee;

export type DepartmentDirectoryView = DepartmentView & {
  status: "active" | "inactive";
  employeeCount: number;
  activeEmployeeCount: number;
  inactiveEmployeeCount: number;
  officeLocation: string | null;
  departmentHead: DepartmentDirectoryHead | null;
  employees: DepartmentDirectoryEmployee[];
};

export type CreateDepartmentRequest = {
  name: string;
  code: string;
  description?: string | null;
};

export type UpdateDepartmentRequest = CreateDepartmentRequest;

export type CreateDepartmentInput = {
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
};
