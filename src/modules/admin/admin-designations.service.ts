import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import { designationsService } from "../designations/designations.service.js";
import type {
  AdminDesignationsServiceResult,
  AdminDesignationsWorkspaceResponse,
} from "./admin-designations.types.js";

function ok<T>(data: T): AdminDesignationsServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(
  status: 403 | 404,
  message: string,
): AdminDesignationsServiceResult<T> {
  return { ok: false, status, message };
}

export const adminDesignationsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminDesignationsServiceResult<AdminDesignationsWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, departments, designations] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      departmentsService.listCompanyDepartments(user.companyId),
      designationsService.listCompanyDesignationDirectory(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const mostUsedDesignation = designations.reduce<
      AdminDesignationsWorkspaceResponse["summary"]["mostUsedDesignation"]
    >((largest, designation) => {
      if (!largest || designation.employeeCount > largest.employeeCount) {
        return {
          id: designation.id,
          title: designation.title,
          employeeCount: designation.employeeCount,
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
        totalDesignations: designations.length,
        totalEmployees: designations.reduce(
          (total, designation) => total + designation.employeeCount,
          0,
        ),
        departmentsWithDesignations: departments.filter(
          (department) => department.designationCount > 0,
        ).length,
        mostUsedDesignation,
      },
      departments,
      designations,
    });
  },
};
