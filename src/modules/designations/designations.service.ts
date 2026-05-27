import { designationsRepository } from "./designations.repository.js";
import type { CreateDesignationInput } from "./designations.types.js";

export const designationsService = {
  listCompanyDesignations(companyId: string) {
    return designationsRepository.listCompanyDesignations(companyId);
  },

  listCompanyDesignationDirectory(companyId: string) {
    return designationsRepository.listCompanyDesignationDirectory(companyId);
  },

  findCompanyDesignationById(companyId: string, designationId: string) {
    return designationsRepository.findCompanyDesignationById(
      companyId,
      designationId,
    );
  },

  createCompanyDesignation(input: CreateDesignationInput) {
    return designationsRepository.createCompanyDesignation(input);
  },

  updateCompanyDesignation(
    companyId: string,
    designationId: string,
    input: Omit<CreateDesignationInput, "companyId">,
  ) {
    return designationsRepository.updateCompanyDesignation(
      companyId,
      designationId,
      input,
    );
  },
};
