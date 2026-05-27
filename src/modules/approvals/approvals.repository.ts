import { randomUUID } from "node:crypto";
import { query, withTransaction, type DatabaseExecutor } from "../../database/index.js";
import { isAppRole } from "../roles/roles.types.js";
import {
  APPROVAL_ENTITY_TYPES,
  APPROVAL_ROLE_DESCRIPTIONS,
  APPROVAL_ROLE_LABELS,
  DEFAULT_APPROVAL_ENTITY_TYPE_LABELS,
  APPROVAL_STEP_ROLES,
  type ApprovalApproverSummary,
  type ApprovalEntityType,
  type ApprovalFlowSummary,
  type ApprovalFlowStepSummary,
  type ApprovalProgress,
  type ApprovalProgressStep,
  type ApprovalRoleOption,
  type ApprovalStepRole,
  type ApprovalWorkspaceResponse,
} from "./approvals.types.js";
import type {
  CreateApprovalFlowRequest,
  UpdateApprovalFlowRequest,
} from "./approvals.validation.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type ApprovalFlowRow = {
  id: string;
  companyId: string;
  entityType: string;
  name: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ApprovalStepRow = {
  id: string;
  flowId: string;
  stepOrder: number;
  role: string;
  isRequired: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ApprovalProgressRow = {
  flowId: string;
  flowEntityType: string;
  flowName: string;
  flowIsActive: boolean;
  stepId: string;
  stepOrder: number;
  stepRole: string;
  stepIsRequired: boolean;
  entityId: string;
  recordId: string;
  recordStatus: string;
  approverId: string | null;
  approverUserId: string | null;
  approverFullName: string | null;
  approverEmail: string | null;
  approverRole: string | null;
  actedAt: Date | string | null;
  remarks: string | null;
};

type FlowStepInput = {
  role: ApprovalStepRole;
  isRequired: boolean;
};

type FlowInsertInput = {
  entityType: ApprovalEntityType;
  name: string;
  steps: readonly FlowStepInput[];
};

type ApprovalApproverRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapStepRole(role: string): ApprovalStepRole {
  return APPROVAL_STEP_ROLES.includes(role as ApprovalStepRole)
    ? (role as ApprovalStepRole)
    : "manager";
}

function isApprovalProgressRow(row: ApprovalProgressRow) {
  return (
    APPROVAL_ENTITY_TYPES.includes(row.flowEntityType as ApprovalEntityType) &&
    APPROVAL_STEP_ROLES.includes(row.stepRole as ApprovalStepRole) &&
    (row.approverRole === null || isAppRole(row.approverRole))
  );
}

function mapApprovalApprover(
  row: ApprovalApproverRow | undefined,
): ApprovalApproverSummary | null {
  if (!row || !isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role,
  };
}

async function resolveApprovalStepApprover(
  executor: DatabaseExecutor,
  companyId: string,
  role: ApprovalStepRole,
  createdByUserId: string,
) {
  if (role === "employee") {
    const result = await executor.query<ApprovalApproverRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email,
          role
        FROM users
        WHERE id = $1
          AND company_id = $2
          AND is_active = TRUE
        LIMIT 1
      `,
      [createdByUserId, companyId],
    );

    return mapApprovalApprover(result.rows[0]);
  }

  if (role === "manager") {
    const result = await executor.query<ApprovalApproverRow>(
      `
        SELECT
          id,
          full_name AS "fullName",
          email,
          role
        FROM users
        WHERE company_id = $1
          AND is_active = TRUE
          AND role IN ('project-manager', 'team-lead')
        ORDER BY
          CASE role
            WHEN 'project-manager' THEN 0
            WHEN 'team-lead' THEN 1
            ELSE 2
          END,
          full_name ASC,
          created_at ASC
        LIMIT 1
      `,
      [companyId],
    );

    return mapApprovalApprover(result.rows[0]);
  }

  if (role === "admin") {
    const result = await executor.query<ApprovalApproverRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role
        FROM users
        INNER JOIN company_admins
          ON company_admins.company_id = $1
          AND company_admins.admin_user_id = users.id
        WHERE users.company_id = $1
          AND users.role = 'admin'
          AND users.is_active = TRUE
        ORDER BY users.full_name ASC, users.created_at ASC
        LIMIT 1
      `,
      [companyId],
    );

    return mapApprovalApprover(result.rows[0]);
  }

  const result = await executor.query<ApprovalApproverRow>(
    `
      SELECT
        id,
        full_name AS "fullName",
        email,
        role
      FROM users
      WHERE company_id = $1
        AND role = $2
        AND is_active = TRUE
      ORDER BY full_name ASC, created_at ASC
      LIMIT 1
    `,
    [companyId, role],
  );

  return mapApprovalApprover(result.rows[0]);
}

function mapApprover(
  row: Pick<
    ApprovalProgressRow,
    "approverId" | "approverUserId" | "approverFullName" | "approverEmail" | "approverRole"
  >,
): ApprovalApproverSummary | null {
  if (
    !row.approverId ||
    !row.approverUserId ||
    !row.approverFullName ||
    !row.approverEmail ||
    !row.approverRole ||
    !isAppRole(row.approverRole)
  ) {
    return null;
  }

  return {
    id: row.approverUserId,
    fullName: row.approverFullName,
    email: row.approverEmail.toLowerCase(),
    role: row.approverRole,
  };
}

function mapFlowStepSummary(
  row: ApprovalStepRow,
): ApprovalFlowStepSummary | null {
  if (!APPROVAL_STEP_ROLES.includes(row.role as ApprovalStepRole)) {
    return null;
  }

  return {
    id: row.id,
    flowId: row.flowId,
    stepOrder: row.stepOrder,
    role: row.role as ApprovalStepRole,
    roleLabel: APPROVAL_ROLE_LABELS[row.role as ApprovalStepRole] ?? row.role,
    isRequired: row.isRequired,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapFlowSummary(
  row: ApprovalFlowRow,
  steps: ApprovalFlowStepSummary[],
): ApprovalFlowSummary | null {
  if (!APPROVAL_ENTITY_TYPES.includes(row.entityType as ApprovalEntityType)) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    entityType: row.entityType as ApprovalEntityType,
    name: row.name,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    steps,
  };
}

function mapProgressSteps(
  rows: readonly ApprovalProgressRow[],
): ApprovalProgressStep[] {
  const sortedRows = [...rows].sort((left, right) => left.stepOrder - right.stepOrder);
  let currentIndex = -1;
  let rejectedIndex = -1;

  for (let index = 0; index < sortedRows.length; index += 1) {
    const row = sortedRows[index];

    if (row.recordStatus === "rejected") {
      rejectedIndex = index;
      break;
    }

    if (row.recordStatus === "pending" && currentIndex === -1) {
      const priorApproved = sortedRows
        .slice(0, index)
        .every((priorRow) => priorRow.recordStatus === "approved");

      if (priorApproved) {
        currentIndex = index;
      }
    }
  }

  return sortedRows.map((row, index) => {
    const isCurrent = currentIndex === index;
    const isLocked =
      rejectedIndex >= 0
        ? index > rejectedIndex
        : currentIndex >= 0
          ? index > currentIndex
          : false;

    return {
      id: row.stepId,
      stepOrder: row.stepOrder,
      role: mapStepRole(row.stepRole),
      roleLabel:
        APPROVAL_ROLE_LABELS[mapStepRole(row.stepRole)] ?? row.stepRole,
      isRequired: row.stepIsRequired,
      status: row.recordStatus as "pending" | "approved" | "rejected",
      isCurrent,
      isLocked,
      approver: mapApprover(row),
      actedAt: row.actedAt ? toIsoString(row.actedAt) : null,
      remarks: row.remarks,
    };
  });
}

function mapProgress(rows: readonly ApprovalProgressRow[]): ApprovalProgress | null {
  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];

  if (!isApprovalProgressRow(firstRow)) {
    return null;
  }

  const steps = mapProgressSteps(rows);
  const completedSteps = steps.filter((step) => step.status === "approved").length;
  const rejectedStep = steps.find((step) => step.status === "rejected") ?? null;
  const currentStep = steps.find((step) => step.isCurrent) ?? null;

  return {
    entityType: firstRow.flowEntityType as ApprovalEntityType,
    entityId: firstRow.entityId,
    flow: {
      id: firstRow.flowId,
      name: firstRow.flowName,
      entityType: firstRow.flowEntityType as ApprovalEntityType,
      isActive: firstRow.flowIsActive,
    },
    status: rejectedStep
      ? "rejected"
      : completedSteps === steps.length && steps.length > 0
        ? "approved"
        : "pending",
    totalSteps: steps.length,
    completedSteps,
    currentStepOrder: currentStep?.stepOrder ?? null,
    steps,
  };
}

async function loadFlowRows(
  executor: DatabaseExecutor,
  companyId: string,
  flowIds?: readonly string[],
) {
  const flowResult = flowIds && flowIds.length > 0
    ? await executor.query<ApprovalFlowRow>(
        `
          SELECT
            id,
            company_id AS "companyId",
            entity_type AS "entityType",
            name,
            is_active AS "isActive",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM approval_flows
          WHERE company_id = $1
            AND id = ANY($2::text[])
          ORDER BY is_active DESC, updated_at DESC, created_at DESC
        `,
        [companyId, [...new Set(flowIds)]],
      )
    : await executor.query<ApprovalFlowRow>(
        `
          SELECT
            id,
            company_id AS "companyId",
            entity_type AS "entityType",
            name,
            is_active AS "isActive",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM approval_flows
          WHERE company_id = $1
          ORDER BY is_active DESC, updated_at DESC, created_at DESC
        `,
        [companyId],
      );

  return flowResult.rows;
}

async function loadStepRows(
  executor: DatabaseExecutor,
  flowIds: readonly string[],
) {
  if (flowIds.length === 0) {
    return [] as ApprovalStepRow[];
  }

  const result = await executor.query<ApprovalStepRow>(
    `
      SELECT
        id,
        flow_id AS "flowId",
        step_order AS "stepOrder",
        role,
        is_required AS "isRequired",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM approval_steps
      WHERE flow_id = ANY($1::text[])
      ORDER BY flow_id ASC, step_order ASC, created_at ASC
    `,
    [[...new Set(flowIds)]],
  );

  return result.rows;
}

async function loadProgressRows(
  executor: DatabaseExecutor,
  companyId: string,
  entityType: ApprovalEntityType,
  entityIds: readonly string[],
) {
  if (entityIds.length === 0) {
    return [] as ApprovalProgressRow[];
  }

  const result = await executor.query<ApprovalProgressRow>(
    `
      SELECT
        flows.id AS "flowId",
        flows.entity_type AS "flowEntityType",
        flows.name AS "flowName",
        flows.is_active AS "flowIsActive",
        steps.id AS "stepId",
        steps.step_order AS "stepOrder",
        steps.role AS "stepRole",
        steps.is_required AS "stepIsRequired",
        records.entity_id AS "entityId",
        records.id AS "recordId",
        records.status AS "recordStatus",
        records.approver_id AS "approverId",
        records.remarks AS "remarks",
        records.acted_at AS "actedAt",
        approver.id AS "approverUserId",
        approver.full_name AS "approverFullName",
        approver.email AS "approverEmail",
        approver.role AS "approverRole"
      FROM approval_records AS records
      INNER JOIN approval_steps AS steps
        ON steps.id = records.step_id
      INNER JOIN approval_flows AS flows
        ON flows.id = steps.flow_id
      LEFT JOIN users AS approver
        ON approver.id = records.approver_id
      WHERE flows.company_id = $1
        AND records.entity_type = $2
        AND records.entity_id = ANY($3::text[])
      ORDER BY records.entity_id ASC, steps.step_order ASC, records.created_at ASC
    `,
    [companyId, entityType, [...new Set(entityIds)]],
  );

  return result.rows.filter(isApprovalProgressRow);
}

function groupProgressRows(rows: readonly ApprovalProgressRow[]) {
  const byEntityId = new Map<string, ApprovalProgressRow[]>();

  for (const row of rows) {
    const items = byEntityId.get(row.entityId) ?? [];
    items.push(row);
    byEntityId.set(row.entityId, items);
  }

  return byEntityId;
}

async function insertFlowWithSteps(
  executor: DatabaseExecutor,
  companyId: string,
  input: FlowInsertInput,
  isActive: boolean,
) {
  const flowId = randomUUID();
  const flowResult = await executor.query<ApprovalFlowRow>(
    `
      INSERT INTO approval_flows (
        id,
        company_id,
        entity_type,
        name,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING
        id,
        company_id AS "companyId",
        entity_type AS "entityType",
        name,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [flowId, companyId, input.entityType, input.name.trim(), isActive],
  );

  const flow = flowResult.rows[0];

  if (!flow) {
    return null;
  }

  for (const [index, step] of input.steps.entries()) {
    await executor.query(
      `
        INSERT INTO approval_steps (
          id,
          flow_id,
          step_order,
          role,
          is_required,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `,
      [randomUUID(), flow.id, index + 1, step.role, step.isRequired],
    );
  }

  return findFlowById(executor, companyId, flow.id);
}

async function insertDefaultLeaveFlow(executor: DatabaseExecutor, companyId: string) {
  return insertFlowWithSteps(
    executor,
    companyId,
    {
      entityType: "leave",
      name: "Leave Approval Flow",
      steps: [
        { role: "manager", isRequired: true },
        { role: "hr", isRequired: true },
      ],
    },
    true,
  );
}

async function insertDefaultOnboardingFlow(
  executor: DatabaseExecutor,
  companyId: string,
) {
  return insertFlowWithSteps(
    executor,
    companyId,
    {
      entityType: "onboarding",
      name: "Onboarding Approval Flow",
      steps: [{ role: "hr", isRequired: true }],
    },
    true,
  );
}

async function insertDefaultOffboardingFlow(
  executor: DatabaseExecutor,
  companyId: string,
) {
  return insertFlowWithSteps(
    executor,
    companyId,
    {
      entityType: "offboarding",
      name: "Offboarding Approval Flow",
      steps: [{ role: "hr", isRequired: true }],
    },
    true,
  );
}

async function insertDefaultAttendanceCorrectionFlow(
  executor: DatabaseExecutor,
  companyId: string,
) {
  return insertFlowWithSteps(
    executor,
    companyId,
    {
      entityType: "attendance-correction",
      name: "Attendance Correction Approval Flow",
      steps: [{ role: "hr", isRequired: true }],
    },
    true,
  );
}

async function findFlowById(
  executor: DatabaseExecutor,
  companyId: string,
  flowId: string,
) {
  const flowResult = await executor.query<ApprovalFlowRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        entity_type AS "entityType",
        name,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM approval_flows
      WHERE company_id = $1
        AND id = $2
      LIMIT 1
    `,
    [companyId, flowId],
  );

  const flow = flowResult.rows[0];

  if (!flow) {
    return null;
  }

  const stepRows = await loadStepRows(executor, [flow.id]);
  const steps = stepRows
    .map((stepRow: ApprovalStepRow) => mapFlowStepSummary(stepRow))
    .filter((step): step is ApprovalFlowStepSummary => step !== null);

  return mapFlowSummary(flow, steps);
}

async function findActiveFlowByEntity(
  executor: DatabaseExecutor,
  companyId: string,
  entityType: ApprovalEntityType,
) {
  const flowResult = await executor.query<ApprovalFlowRow>(
    `
      SELECT
        id,
        company_id AS "companyId",
        entity_type AS "entityType",
        name,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM approval_flows
      WHERE company_id = $1
        AND entity_type = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [companyId, entityType],
  );

  const flow = flowResult.rows[0];

  if (!flow) {
    return null;
  }

  const stepRows = await loadStepRows(executor, [flow.id]);
  const steps = stepRows
    .map((stepRow: ApprovalStepRow) => mapFlowStepSummary(stepRow))
    .filter((step): step is ApprovalFlowStepSummary => step !== null);

  return mapFlowSummary(flow, steps);
}

async function upsertLeaveFlowIfMissing(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const activeFlow = await findActiveFlowByEntity(executor, companyId, "leave");

  if (activeFlow) {
    if (activeFlow.steps.length > 0) {
      return activeFlow;
    }

    for (const [index, step] of [
      { role: "manager" as const, isRequired: true },
      { role: "hr" as const, isRequired: true },
    ].entries()) {
      await executor.query(
        `
          INSERT INTO approval_steps (
            id,
            flow_id,
            step_order,
            role,
            is_required,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (flow_id, step_order) DO NOTHING
        `,
        [randomUUID(), activeFlow.id, index + 1, step.role, step.isRequired],
      );
    }

    return findFlowById(executor, companyId, activeFlow.id);
  }

  return insertDefaultLeaveFlow(executor, companyId);
}

async function upsertOnboardingFlowIfMissing(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const activeFlow = await findActiveFlowByEntity(executor, companyId, "onboarding");

  if (activeFlow) {
    if (activeFlow.steps.length > 0) {
      return activeFlow;
    }

    await executor.query(
      `
        INSERT INTO approval_steps (
          id,
          flow_id,
          step_order,
          role,
          is_required,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (flow_id, step_order) DO NOTHING
      `,
      [randomUUID(), activeFlow.id, 1, "hr", true],
    );

    return findFlowById(executor, companyId, activeFlow.id);
  }

  return insertDefaultOnboardingFlow(executor, companyId);
}

async function upsertOffboardingFlowIfMissing(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const activeFlow = await findActiveFlowByEntity(
    executor,
    companyId,
    "offboarding",
  );

  if (activeFlow) {
    if (activeFlow.steps.length > 0) {
      return activeFlow;
    }

    await executor.query(
      `
        INSERT INTO approval_steps (
          id,
          flow_id,
          step_order,
          role,
          is_required,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (flow_id, step_order) DO NOTHING
      `,
      [randomUUID(), activeFlow.id, 1, "hr", true],
    );

    return findFlowById(executor, companyId, activeFlow.id);
  }

  return insertDefaultOffboardingFlow(executor, companyId);
}

async function upsertAttendanceCorrectionFlowIfMissing(
  executor: DatabaseExecutor,
  companyId: string,
) {
  const activeFlow = await findActiveFlowByEntity(
    executor,
    companyId,
    "attendance-correction",
  );

  if (activeFlow) {
    if (activeFlow.steps.length > 0) {
      return activeFlow;
    }

    await executor.query(
      `
        INSERT INTO approval_steps (
          id,
          flow_id,
          step_order,
          role,
          is_required,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (flow_id, step_order) DO NOTHING
      `,
      [randomUUID(), activeFlow.id, 1, "hr", true],
    );

    return findFlowById(executor, companyId, activeFlow.id);
  }

  return insertDefaultAttendanceCorrectionFlow(executor, companyId);
}

async function archiveFlowAndCreateVersion(
  executor: DatabaseExecutor,
  companyId: string,
  flowId: string,
  input: UpdateApprovalFlowRequest,
) {
  const currentFlow = await findFlowById(executor, companyId, flowId);

  if (!currentFlow || !currentFlow.isActive || currentFlow.entityType !== input.entityType) {
    return null;
  }

  await executor.query(
    `
      UPDATE approval_flows
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $1
        AND company_id = $2
    `,
    [flowId, companyId],
  );

  const nextFlow = await insertFlowWithSteps(executor, companyId, input, true);

  if (!nextFlow) {
    throw new Error("Unable to version the approval flow.");
  }

  return nextFlow;
}

function buildWorkspaceSummary(flows: readonly ApprovalFlowSummary[]) {
  return {
    totalFlows: flows.length,
    activeFlows: flows.filter((flow) => flow.isActive).length,
    archivedFlows: flows.filter((flow) => !flow.isActive).length,
    totalSteps: flows.reduce((count, flow) => count + flow.steps.length, 0),
  };
}

function buildRoleOptions(): ApprovalRoleOption[] {
  return APPROVAL_STEP_ROLES.map((role) => ({
    value: role,
    label: APPROVAL_ROLE_LABELS[role],
    description: APPROVAL_ROLE_DESCRIPTIONS[role],
  }));
}

export const approvalsRepository = {
  listEntityTypes() {
    return APPROVAL_ENTITY_TYPES.map((entityType) => ({
      value: entityType,
      label: DEFAULT_APPROVAL_ENTITY_TYPE_LABELS[entityType] ?? entityType,
      description:
        entityType === "leave"
          ? "Leave request approval workflow."
          : entityType === "onboarding"
            ? "Employee onboarding approval workflow."
            : entityType === "offboarding"
              ? "Employee offboarding approval workflow."
              : entityType === "attendance-correction"
                ? "Attendance correction approval workflow."
                : `Approval workflow for ${entityType}.`,
    }));
  },

  listRoleOptions() {
    return buildRoleOptions();
  },

  async listWorkspace(companyId: string): Promise<ApprovalWorkspaceResponse> {
    const flows = await this.listApprovalFlows(companyId);

    return {
      company: await (async () => {
        const companyResult = await query<{
          id: string;
          name: string;
          code: string;
          status: string;
        }>(
          `
            SELECT id, name, code, status
            FROM companies
            WHERE id = $1
            LIMIT 1
          `,
          [companyId],
        );

        const company = companyResult.rows[0];

        return {
          id: company?.id ?? companyId,
          name: company?.name ?? "Unknown Company",
          code: company?.code ?? "unknown",
          status: (company?.status as ApprovalWorkspaceResponse["company"]["status"]) ?? "inactive",
        };
      })(),
      summary: buildWorkspaceSummary(flows),
      entityTypes: this.listEntityTypes(),
      roleOptions: this.listRoleOptions(),
      flows,
    };
  },

  async listApprovalFlows(companyId: string) {
    const flowRows = await loadFlowRows(defaultExecutor, companyId);
    const stepRows = await loadStepRows(
      defaultExecutor,
      flowRows.map((flow: ApprovalFlowRow) => flow.id),
    );
    const stepsByFlowId = new Map<string, ApprovalFlowStepSummary[]>();

    for (const stepRow of stepRows) {
      const step = mapFlowStepSummary(stepRow);

      if (!step) {
        continue;
      }

      const steps = stepsByFlowId.get(step.flowId) ?? [];
      steps.push(step);
      stepsByFlowId.set(step.flowId, steps);
    }

    return flowRows
      .map((flowRow: ApprovalFlowRow) =>
        mapFlowSummary(flowRow, stepsByFlowId.get(flowRow.id) ?? []),
      )
      .filter((flow): flow is ApprovalFlowSummary => flow !== null);
  },

  async findActiveApprovalFlow(
    companyId: string,
    entityType: ApprovalEntityType,
  ) {
    return findActiveFlowByEntity(defaultExecutor, companyId, entityType);
  },

  async findApprovalFlowById(companyId: string, flowId: string) {
    return findFlowById(defaultExecutor, companyId, flowId);
  },

  async createApprovalFlow(
    companyId: string,
    input: CreateApprovalFlowRequest,
  ) {
    return withTransaction(async (client) => {
      const existingActive = await findActiveFlowByEntity(
        client,
        companyId,
        input.entityType,
      );

      if (existingActive) {
        await client.query(
          `
            UPDATE approval_flows
            SET
              is_active = FALSE,
              updated_at = NOW()
            WHERE id = $1
              AND company_id = $2
          `,
          [existingActive.id, companyId],
        );
      }

      return insertFlowWithSteps(client, companyId, input, true);
    });
  },

  async updateApprovalFlow(
    companyId: string,
    flowId: string,
    input: UpdateApprovalFlowRequest,
  ) {
    return withTransaction(async (client) =>
      archiveFlowAndCreateVersion(client, companyId, flowId, input),
    );
  },

  async ensureActiveLeaveFlow(companyId: string) {
    return withTransaction(async (client) =>
      upsertLeaveFlowIfMissing(client, companyId),
    );
  },

  async ensureActiveOnboardingFlow(companyId: string) {
    return withTransaction(async (client) =>
      upsertOnboardingFlowIfMissing(client, companyId),
    );
  },

  async ensureActiveOffboardingFlow(companyId: string) {
    return withTransaction(async (client) =>
      upsertOffboardingFlowIfMissing(client, companyId),
    );
  },

  async ensureActiveAttendanceCorrectionFlow(companyId: string) {
    return withTransaction(async (client) =>
      upsertAttendanceCorrectionFlowIfMissing(client, companyId),
    );
  },

  async createApprovalChainForEntity(
    executor: DatabaseExecutor,
    entityType: ApprovalEntityType,
    entityId: string,
    flow: ApprovalFlowSummary,
    createdByUserId: string,
  ) {
    if (flow.steps.length === 0) {
      return null;
    }

    const approvers: ApprovalApproverSummary[] = [];

    for (const step of flow.steps) {
      const approver = await resolveApprovalStepApprover(
        executor,
        flow.companyId,
        step.role,
        createdByUserId,
      );

      if (!approver) {
        return null;
      }

      approvers.push(approver);
    }

    const requestId = randomUUID();

    await executor.query(
      `
        INSERT INTO approval_requests (
          id,
          company_id,
          flow_id,
          module,
          entity_id,
          status,
          current_step,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', 1, $6, NOW(), NOW())
      `,
      [
        requestId,
        flow.companyId,
        flow.id,
        entityType,
        entityId,
        createdByUserId,
      ],
    );

    for (const [index, step] of flow.steps.entries()) {
      await executor.query(
        `
          INSERT INTO approval_records (
            id,
            request_id,
            entity_type,
            entity_id,
            step_id,
            approver_id,
            status,
            acted_at,
            remarks,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NULL, NULL, NOW(), NOW())
          ON CONFLICT (entity_type, entity_id, step_id) DO NOTHING
        `,
        [
          randomUUID(),
          requestId,
          entityType,
          entityId,
          step.id,
          approvers[index]?.id ?? null,
        ],
      );
    }

    return requestId;
  },

  async listEntityApprovalProgress(
    companyId: string,
    entityType: ApprovalEntityType,
    entityIds: readonly string[],
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const rows = await loadProgressRows(
      executor,
      companyId,
      entityType,
      entityIds,
    );
    const groupedRows = groupProgressRows(rows);
    const progressByEntityId = new Map<string, ApprovalProgress>();

    for (const [entityId, entityRows] of groupedRows.entries()) {
      const progress = mapProgress(entityRows);

      if (progress) {
        progressByEntityId.set(entityId, progress);
      }
    }

    return progressByEntityId;
  },

  async getEntityApprovalProgress(
    companyId: string,
    entityType: ApprovalEntityType,
    entityId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const progress = await this.listEntityApprovalProgress(
      companyId,
      entityType,
      [entityId],
      executor,
    );

    return progress.get(entityId) ?? null;
  },

  async recordApprovalDecision(
    executor: DatabaseExecutor,
    input: {
      companyId: string;
      entityType: ApprovalEntityType;
      entityId: string;
      stepId: string;
      approverId: string;
      status: "approved" | "rejected";
      remarks?: string | null;
    },
  ) {
    const result = await executor.query<{
      id: string;
      entityId: string;
      stepId: string;
      stepOrder: number;
      status: string;
      requestId: string | null;
    }>(
      `
        WITH updated_record AS (
          UPDATE approval_records
          SET
            approver_id = COALESCE(approver_id, $1),
            status = $2,
            acted_at = NOW(),
            remarks = COALESCE($6, remarks),
            updated_at = NOW()
          WHERE entity_type = $3
            AND entity_id = $4
            AND step_id = $5
            AND status = 'pending'
            AND (approver_id = $1 OR approver_id IS NULL)
          RETURNING
            id,
            entity_id AS "entityId",
            step_id AS "stepId",
            status,
            request_id AS "requestId"
        )
        SELECT
          updated_record.id,
          updated_record."entityId",
          updated_record."stepId",
          steps.step_order AS "stepOrder",
          updated_record.status,
          updated_record."requestId"
        FROM updated_record
        INNER JOIN approval_steps AS steps
          ON steps.id = updated_record."stepId"
      `,
      [
        input.approverId,
        input.status,
        input.entityType,
        input.entityId,
        input.stepId,
        input.remarks ?? null,
      ],
    );

    const updatedStep = result.rows[0] ?? null;

    if (!updatedStep) {
      return null;
    }

    const progress = await this.getEntityApprovalProgress(
      input.companyId,
      input.entityType,
      input.entityId,
      executor,
    );

    if (updatedStep.requestId && progress) {
      const nextRequestStatus =
        progress.status === "approved"
          ? "approved"
          : progress.status === "rejected"
            ? "rejected"
            : progress.completedSteps > 0
              ? "in_progress"
              : "pending";
      const nextCurrentStep =
        progress.status === "approved"
          ? progress.totalSteps
          : progress.status === "rejected"
            ? updatedStep.stepOrder
            : progress.currentStepOrder ?? updatedStep.stepOrder;

      await executor.query(
        `
          UPDATE approval_requests
          SET
            status = $2,
            current_step = $3,
            updated_at = NOW()
          WHERE id = $1
            AND company_id = $4
        `,
        [
          updatedStep.requestId,
          nextRequestStatus,
          nextCurrentStep,
          input.companyId,
        ],
      );
    }

    return updatedStep;
  },
};
