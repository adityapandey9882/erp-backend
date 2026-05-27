export type DesignationDepartmentSummary = {
  id: string;
  name: string;
  code: string;
};

export type DesignationView = {
  id: string;
  title: string;
  code: string;
  description: string | null;
  department: DesignationDepartmentSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type DesignationDirectoryEmployee = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentName: string | null;
  status: "active" | "inactive";
  profilePhotoUrl: string | null;
};

export type DesignationDirectoryView = DesignationView & {
  status: "active" | "inactive";
  employeeCount: number;
  activeEmployeeCount: number;
  inactiveEmployeeCount: number;
  employees: DesignationDirectoryEmployee[];
};

export type CreateDesignationRequest = {
  title: string;
  code: string;
  description?: string | null;
  departmentId?: string | null;
};

export type UpdateDesignationRequest = CreateDesignationRequest;

export type CreateDesignationInput = {
  companyId: string;
  title: string;
  code: string;
  description?: string | null;
  departmentId?: string | null;
};
