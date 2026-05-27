import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import type {
  AdminDepartmentsServiceResult,
  AdminDepartmentsWorkspaceResponse,
} from "./admin-departments.types.js";

function ok<T>(data: T): AdminDepartmentsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404,
  message: string,
): AdminDepartmentsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

export const adminDepartmentsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminDepartmentsServiceResult<AdminDepartmentsWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, departments] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      departmentsService.listCompanyDepartmentDirectory(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const largestDepartment = departments.reduce<
      AdminDepartmentsWorkspaceResponse["summary"]["largestDepartment"]
    >((largest, department) => {
      if (!largest || department.employeeCount > largest.employeeCount) {
        return {
          id: department.id,
          name: department.name,
          employeeCount: department.employeeCount,
        };
      }

      return largest;
    }, null);

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      summary: {
        totalDepartments: departments.length,
        totalEmployees: departments.reduce(
          (total, department) => total + department.employeeCount,
          0,
        ),
        activeDepartments: departments.filter(
          (department) => department.status === "active",
        ).length,
        inactiveDepartments: departments.filter(
          (department) => department.status === "inactive",
        ).length,
        largestDepartment,
      },
      departments,
    });
  },
};
