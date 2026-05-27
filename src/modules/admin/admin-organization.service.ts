import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { departmentsService } from "../departments/departments.service.js";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "../departments/departments.types.js";
import { designationsService } from "../designations/designations.service.js";
import type {
  CreateDesignationRequest,
  UpdateDesignationRequest,
} from "../designations/designations.types.js";
import type {
  AdminOrganizationServiceResult,
  AdminOrganizationWorkspaceResponse,
  DepartmentMutationResponse,
  DesignationMutationResponse,
} from "./admin-organization.types.js";

function ok<T>(data: T): AdminOrganizationServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): AdminOrganizationServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function summarizeOrganization(
  data: Pick<AdminOrganizationWorkspaceResponse, "departments" | "designations">,
) {
  const departmentsWithDesignations = data.departments.filter(
    (department) => department.designationCount > 0,
  ).length;
  const mappedDesignations = data.designations.filter(
    (designation) => designation.department !== null,
  ).length;

  return {
    totalDepartments: data.departments.length,
    totalDesignations: data.designations.length,
    departmentsWithDesignations,
    departmentsWithoutDesignations:
      data.departments.length - departmentsWithDesignations,
    mappedDesignations,
    unassignedDesignations: data.designations.length - mappedDesignations,
  };
}

async function ensureCompany(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

async function ensureDesignationDepartment(
  companyId: string,
  departmentId?: string | null,
) {
  if (!departmentId) {
    return {
      ok: true as const,
      departmentId: null,
    };
  }

  const department = await departmentsService.findCompanyDepartmentById(
    companyId,
    departmentId,
  );

  if (!department) {
    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    departmentId: department.id,
  };
}

export const adminOrganizationService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminOrganizationServiceResult<AdminOrganizationWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, departments, designations] = await Promise.all([
      ensureCompany(user),
      departmentsService.listCompanyDepartments(user.companyId),
      designationsService.listCompanyDesignations(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        contactEmail: company.contactEmail,
        status: company.status,
      },
      summary: summarizeOrganization({ departments, designations }),
      departments,
      designations,
    });
  },

  async createDepartment(
    user: AuthenticatedUser,
    input: CreateDepartmentRequest,
  ): Promise<AdminOrganizationServiceResult<DepartmentMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompany(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    try {
      const department = await departmentsService.createCompanyDepartment({
        companyId: user.companyId,
        name: input.name,
        code: input.code,
        description: input.description ?? null,
      });

      if (!department) {
        return fail(404, "Unable to create the department.");
      }

      return ok({
        message: "Department created successfully.",
        department,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "A department with this name or code already exists for the company.",
        );
      }

      throw error;
    }
  },

  async updateDepartment(
    user: AuthenticatedUser,
    departmentId: string,
    input: UpdateDepartmentRequest,
  ): Promise<AdminOrganizationServiceResult<DepartmentMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingDepartment = await departmentsService.findCompanyDepartmentById(
      user.companyId,
      departmentId,
    );

    if (!existingDepartment) {
      return fail(404, "Department not found.");
    }

    try {
      const department = await departmentsService.updateCompanyDepartment(
        user.companyId,
        departmentId,
        {
          name: input.name,
          code: input.code,
          description: input.description ?? null,
        },
      );

      if (!department) {
        return fail(404, "Department not found.");
      }

      return ok({
        message: "Department updated successfully.",
        department,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "A department with this name or code already exists for the company.",
        );
      }

      throw error;
    }
  },

  async createDesignation(
    user: AuthenticatedUser,
    input: CreateDesignationRequest,
  ): Promise<AdminOrganizationServiceResult<DesignationMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await ensureCompany(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const departmentCheck = await ensureDesignationDepartment(
      user.companyId,
      input.departmentId,
    );

    if (!departmentCheck.ok) {
      return fail(404, "Department not found for this company.");
    }

    try {
      const designation = await designationsService.createCompanyDesignation({
        companyId: user.companyId,
        title: input.title,
        code: input.code,
        description: input.description ?? null,
        departmentId: departmentCheck.departmentId,
      });

      if (!designation) {
        return fail(404, "Unable to create the designation.");
      }

      return ok({
        message: "Designation created successfully.",
        designation,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "A designation with this title or code already exists for the company.",
        );
      }

      throw error;
    }
  },

  async updateDesignation(
    user: AuthenticatedUser,
    designationId: string,
    input: UpdateDesignationRequest,
  ): Promise<AdminOrganizationServiceResult<DesignationMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingDesignation = await designationsService.findCompanyDesignationById(
      user.companyId,
      designationId,
    );

    if (!existingDesignation) {
      return fail(404, "Designation not found.");
    }

    const departmentCheck = await ensureDesignationDepartment(
      user.companyId,
      input.departmentId,
    );

    if (!departmentCheck.ok) {
      return fail(404, "Department not found for this company.");
    }

    try {
      const designation = await designationsService.updateCompanyDesignation(
        user.companyId,
        designationId,
        {
          title: input.title,
          code: input.code,
          description: input.description ?? null,
          departmentId: departmentCheck.departmentId,
        },
      );

      if (!designation) {
        return fail(404, "Designation not found.");
      }

      return ok({
        message: "Designation updated successfully.",
        designation,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail(
          409,
          "A designation with this title or code already exists for the company.",
        );
      }

      throw error;
    }
  },
};
