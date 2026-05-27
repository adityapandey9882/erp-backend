import { usersRepository } from "../users/users.repository.js";
import type {
  CompanyUserProfile,
  CompanyUserRoleSummary,
} from "../users/users.types.js";

function isHrVisibleRecord<T extends { role: string }>(record: T) {
  return record.role !== "admin";
}

function filterHrVisibleEmployees(employees: CompanyUserProfile[]) {
  return employees.filter(isHrVisibleRecord);
}

function filterHrVisibleRoleSummary(summary: CompanyUserRoleSummary[]) {
  return summary.filter(isHrVisibleRecord);
}

export const hrRepository = {
  async listCompanyEmployeeProfiles(companyId: string) {
    const employees = await usersRepository.listCompanyUserProfiles(companyId);

    return filterHrVisibleEmployees(employees);
  },

  async findCompanyEmployeeProfileById(companyId: string, userId: string) {
    const employee = await usersRepository.findCompanyUserProfileById(
      companyId,
      userId,
    );

    if (!employee || !isHrVisibleRecord(employee)) {
      return null;
    }

    return employee;
  },

  async getCompanyEmployeeRoleSummary(companyId: string) {
    const summary = await usersRepository.getCompanyUserRoleSummary(companyId);

    return filterHrVisibleRoleSummary(summary);
  },

  updateCompanyEmployeeProfile(
    companyId: string,
    userId: string,
    input: {
      departmentId: string | null;
      designationId: string | null;
    },
  ) {
    return usersRepository.updateCompanyUserOrganizationProfile(
      companyId,
      userId,
      input,
    );
  },
};
