import { departmentsRepository } from "./departments.repository.js";
import type { CreateDepartmentInput } from "./departments.types.js";

export const departmentsService = {
  listCompanyDepartments(companyId: string) {
    return departmentsRepository.listCompanyDepartments(companyId);
  },

  listCompanyDepartmentDirectory(companyId: string) {
    return departmentsRepository.listCompanyDepartmentDirectory(companyId);
  },

  findCompanyDepartmentById(companyId: string, departmentId: string) {
    return departmentsRepository.findCompanyDepartmentById(companyId, departmentId);
  },

  createCompanyDepartment(input: CreateDepartmentInput) {
    return departmentsRepository.createCompanyDepartment(input);
  },

  updateCompanyDepartment(
    companyId: string,
    departmentId: string,
    input: Omit<CreateDepartmentInput, "companyId">,
  ) {
    return departmentsRepository.updateCompanyDepartment(
      companyId,
      departmentId,
      input,
    );
  },
};
