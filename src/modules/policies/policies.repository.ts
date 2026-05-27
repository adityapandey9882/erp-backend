import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import {
  COMPANY_POLICY_DEFINITIONS,
  COMPANY_POLICY_SECTION_DEFINITIONS,
  getCompanyPolicyDefinition,
  type CompanyPolicyDefinition,
  type CompanyPolicyField,
  type CompanyPolicySection,
  type CompanyPolicyType,
  type CompanyPolicyValue,
  type UpdatePolicyItem,
} from "./policies.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type PolicyRow = {
  id: string;
  companyId: string;
  policyType: string;
  policyKey: string;
  value: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isPolicyValueValid(
  definition: CompanyPolicyDefinition,
  value: unknown,
): value is CompanyPolicyValue {
  if (definition.inputType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (definition.inputType === "toggle") {
    return typeof value === "boolean";
  }

  if (definition.inputType === "select") {
    return (
      typeof value === "string" &&
      (definition.options?.length
        ? definition.options.some((option) => option.value === value)
        : true)
    );
  }

  return false;
}

function normalizePolicyValue(
  definition: CompanyPolicyDefinition,
  value: unknown,
) {
  if (isPolicyValueValid(definition, value)) {
    return value;
  }

  return definition.defaultValue;
}

function mapPolicyField(row: PolicyRow): CompanyPolicyField | null {
  const definition = getCompanyPolicyDefinition(
    row.policyType as CompanyPolicyType,
    row.policyKey,
  );

  if (!definition) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    type: definition.type,
    key: definition.key,
    label: definition.label,
    description: definition.description,
    inputType: definition.inputType,
    defaultValue: definition.defaultValue,
    options: definition.options,
    min: definition.min,
    max: definition.max,
    step: definition.step,
    value: normalizePolicyValue(definition, row.value),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function buildPolicySections(
  rows: readonly PolicyRow[],
): CompanyPolicySection[] {
  const policyFields = rows
    .map((row) => mapPolicyField(row))
    .filter((policy): policy is CompanyPolicyField => policy !== null);
  const policyMap = new Map(
    policyFields.map((policy) => [`${policy.type}:${policy.key}`, policy] as const),
  );

  return COMPANY_POLICY_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    policies: COMPANY_POLICY_DEFINITIONS.filter(
      (definition) => definition.type === section.type,
    )
      .map((definition) => policyMap.get(`${definition.type}:${definition.key}`))
      .filter((policy): policy is CompanyPolicyField => policy != null),
  }));
}

function resolveLatestUpdatedAt(rows: readonly PolicyRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return rows
    .map((row) => toIsoString(row.updatedAt))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

async function loadPolicyRows(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const result = await executor.query<PolicyRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        "type" AS "policyType",
        key AS "policyKey",
        value,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM company_policies
      WHERE company_id = $1
      ORDER BY "type" ASC, key ASC
    `,
    [companyId],
  );

  return result.rows;
}

async function insertPolicyRows(
  executor: DatabaseExecutor,
  companyId: string,
  policies: readonly UpdatePolicyItem[],
  mode: "ignore" | "update",
) {
  for (const policy of policies) {
    const definition = getCompanyPolicyDefinition(policy.type, policy.key);

    if (!definition) {
      continue;
    }

    const policyId = randomUUID();
    const valueJson = JSON.stringify(policy.value);

    if (mode === "ignore") {
      await executor.query(
        `
          INSERT INTO company_policies (
            id,
            company_id,
            "type",
            key,
            value,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
          ON CONFLICT (company_id, "type", key) DO NOTHING
        `,
        [policyId, companyId, policy.type, policy.key, valueJson],
      );
    } else {
      await executor.query(
        `
          INSERT INTO company_policies (
            id,
            company_id,
            "type",
            key,
            value,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
          ON CONFLICT (company_id, "type", key)
          DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
        `,
        [policyId, companyId, policy.type, policy.key, valueJson],
      );
    }
  }
}

export const policiesRepository = {
  listSectionDefinitions() {
    return [...COMPANY_POLICY_SECTION_DEFINITIONS];
  },

  async ensureCompanyPolicies(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const defaultPolicies = COMPANY_POLICY_DEFINITIONS.map((definition) => ({
      type: definition.type,
      key: definition.key,
      value: definition.defaultValue,
    }));

    await insertPolicyRows(executor, companyId, defaultPolicies, "ignore");
  },

  async listCompanyPolicies(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const rows = await loadPolicyRows(executor, companyId);
    return {
      rows,
      sections: buildPolicySections(rows),
      updatedAt: resolveLatestUpdatedAt(rows),
    };
  },

  async upsertCompanyPolicies(
    companyId: string,
    policies: readonly UpdatePolicyItem[],
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    await insertPolicyRows(executor, companyId, policies, "update");
  },
};
