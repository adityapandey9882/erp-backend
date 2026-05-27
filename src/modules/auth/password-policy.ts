import { superadminSettingsRepository } from "../superadmin/superadmin-settings.repository.js";
import type { PasswordPolicyView } from "../superadmin/superadmin.types.js";

const uppercasePattern = /[A-Z]/;
const numberPattern = /[0-9]/;
const specialCharacterPattern = /[^A-Za-z0-9]/;

export type PasswordPolicyRequirement = PasswordPolicyView;

export function describePasswordPolicy(policy: PasswordPolicyRequirement) {
  const requirements = [`be at least ${policy.minimumPasswordLength} characters long`];

  if (policy.requireUppercase) {
    requirements.push("include at least one uppercase letter");
  }

  if (policy.requireNumber) {
    requirements.push("include at least one number");
  }

  if (policy.requireSpecialCharacter) {
    requirements.push("include at least one special character");
  }

  if (requirements.length === 1) {
    return `Password must ${requirements[0]}.`;
  }

  return `Password must ${requirements
    .slice(0, -1)
    .join(", ")}, and ${requirements[requirements.length - 1]}.`;
}

export function findPasswordPolicyViolations(
  password: string,
  policy: PasswordPolicyRequirement,
) {
  const violations: string[] = [];

  if (password.length < policy.minimumPasswordLength) {
    violations.push(`Use at least ${policy.minimumPasswordLength} characters.`);
  }

  if (policy.requireUppercase && !uppercasePattern.test(password)) {
    violations.push("Add at least one uppercase letter.");
  }

  if (policy.requireNumber && !numberPattern.test(password)) {
    violations.push("Add at least one number.");
  }

  if (policy.requireSpecialCharacter && !specialCharacterPattern.test(password)) {
    violations.push("Add at least one special character.");
  }

  return violations;
}

export async function getPasswordPolicy() {
  const settings = await superadminSettingsRepository.getSettings();

  return {
    minimumPasswordLength: settings.security.minimumPasswordLength,
    requireUppercase: settings.security.requireUppercase,
    requireNumber: settings.security.requireNumber,
    requireSpecialCharacter: settings.security.requireSpecialCharacter,
  } satisfies PasswordPolicyRequirement;
}

export async function validatePasswordAgainstPolicy(password: string) {
  const policy = await getPasswordPolicy();
  const violations = findPasswordPolicyViolations(password, policy);

  return {
    policy,
    violations,
    message: violations.length > 0 ? describePasswordPolicy(policy) : null,
  };
}
