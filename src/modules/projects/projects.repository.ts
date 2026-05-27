import { query, type DatabaseExecutor } from "../../database/index.js";
import type {
  ProjectMilestoneDependencyType,
  ProjectMilestoneDueDateFilter,
  ProjectMilestonePriority,
  ProjectMilestoneStatus,
  ProjectMilestoneType,
  ProjectTaskDueDateFilter,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from "./projects.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

export type ProjectTaskProjectRow = {
  id: string;
  projectCode: string;
  name: string;
  projectManagerId: string | null;
  isManager: boolean;
  isMember: boolean;
};

export type ProjectTaskAssigneeRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type ProjectTaskRow = {
  internalId: string;
  companyId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectManagerId: string | null;
  taskCode: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;
  assigneeRole: string;
  reporterId: string | null;
  dueDate: Date | string;
  estimatedMinutes: number | string | null;
  spentMinutes: number | string | null;
  progressPercent: number | string;
  blockedReason: string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
  archivedAt: Date | string | null;
};

export type ProjectTaskChecklistRow = {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedBy: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ProjectTaskCommentRow = {
  id: string;
  taskId: string;
  userId: string | null;
  authorName: string | null;
  comment: string;
  parentCommentId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ProjectTaskActivityRow = {
  id: string;
  taskId: string;
  actorId: string | null;
  actorName: string | null;
  activityType: string;
  oldValue: string | null;
  newValue: string | null;
  metadata: unknown;
  createdAt: Date | string;
};

export type ProjectTaskAttachmentRow = {
  id: string;
  taskId: string;
  documentId: string;
  documentName: string;
  documentType: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | string | null;
  uploadedAt: Date | string;
};

export type ProjectMilestoneRow = {
  internalId: string;
  companyId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectManagerId: string | null;
  milestoneCode: string;
  title: string;
  description: string;
  milestoneType: ProjectMilestoneType;
  phase: string;
  status: ProjectMilestoneStatus;
  priority: ProjectMilestonePriority;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  startDate: Date | string | null;
  dueDate: Date | string;
  targetCompletionDate: Date | string | null;
  completedAt: Date | string | null;
  progressPercent: number | string;
  baselineProgress: number | string | null;
  completionCriteria: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  archivedAt: Date | string | null;
  dependencyCount: number | string;
  fileCount: number | string;
};

export type ProjectMilestoneDependencyRow = {
  id: string;
  milestoneId: string;
  dependsOnMilestoneId: string;
  dependencyType: ProjectMilestoneDependencyType;
  dependsOnCode: string;
  dependsOnTitle: string;
  dependsOnStatus: ProjectMilestoneStatus;
  dependsOnDueDate: Date | string;
  createdAt: Date | string;
};

export type ProjectMilestoneActivityRow = {
  id: string;
  milestoneId: string;
  actorId: string | null;
  actorName: string | null;
  activityType: string;
  oldValue: string | null;
  newValue: string | null;
  metadata: unknown;
  createdAt: Date | string;
};

export type ProjectMilestoneAttachmentRow = ProjectTaskAttachmentRow & {
  milestoneId: string;
};

export type ProjectMemberRow = {
  projectId: string;
  userId: string;
  fullName: string;
  role: string;
};

export type ProjectMilestoneLinkedTaskRow = {
  internalId: string;
  milestoneId: string;
  taskCode: string;
  title: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  dueDate: Date | string;
  progressPercent: number | string;
};

type DefaultProjectWorkspaceInput = {
  companyId: string;
  projectId: string;
  managerId: string;
};

type ListTasksArgs = {
  companyId: string;
  userId: string;
  projectId?: string | null;
  assigneeId?: string | null;
  status?: ProjectTaskStatus | null;
  priority?: ProjectTaskPriority | null;
  dueDateFilter?: ProjectTaskDueDateFilter;
  search?: string | null;
  page?: number;
  limit?: number | null;
};

type ListMilestonesArgs = {
  companyId: string;
  userId: string;
  projectId?: string | null;
  ownerId?: string | null;
  status?: ProjectMilestoneStatus | null;
  priority?: ProjectMilestonePriority | null;
  dueDateFilter?: ProjectMilestoneDueDateFilter;
  search?: string | null;
  page?: number;
  limit?: number | null;
};

type TaskInsertInput = {
  id: string;
  companyId: string;
  projectId: string;
  taskCode: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneeId: string;
  reporterId: string | null;
  dueDate: string;
  estimatedMinutes: number | null;
  spentMinutes: number | null;
  progressPercent: number;
  blockedReason: string | null;
  createdBy: string;
};

type TaskUpdateInput = {
  companyId: string;
  taskId: string;
  title?: string;
  description?: string;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  assigneeId?: string;
  dueDate?: string;
  estimatedMinutes?: number | null;
  spentMinutes?: number | null;
  progressPercent?: number;
  blockedReason?: string | null;
  completedAt?: string | null;
};

type MilestoneInsertInput = {
  id: string;
  companyId: string;
  projectId: string;
  milestoneCode: string;
  title: string;
  description: string;
  milestoneType: ProjectMilestoneType;
  phase: string;
  status: ProjectMilestoneStatus;
  priority: ProjectMilestonePriority;
  ownerId: string;
  startDate: string | null;
  dueDate: string;
  targetCompletionDate: string | null;
  progressPercent: number;
  baselineProgress: number | null;
  completionCriteria: string | null;
  createdBy: string;
};

type MilestoneUpdateInput = {
  companyId: string;
  milestoneId: string;
  title?: string;
  description?: string;
  milestoneType?: ProjectMilestoneType;
  phase?: string;
  status?: ProjectMilestoneStatus;
  priority?: ProjectMilestonePriority;
  ownerId?: string;
  startDate?: string | null;
  dueDate?: string;
  targetCompletionDate?: string | null;
  completedAt?: string | null;
  progressPercent?: number;
  baselineProgress?: number | null;
  completionCriteria?: string | null;
};

function buildTaskFromSql() {
  return `
    FROM project_tasks
    INNER JOIN projects
      ON projects.id = project_tasks.project_id
     AND projects.company_id = project_tasks.company_id
    INNER JOIN users AS assignee
      ON assignee.id = project_tasks.assignee_id
  `;
}

function buildTaskSelectSql() {
  return `
    SELECT
      project_tasks.id AS "internalId",
      project_tasks.company_id AS "companyId",
      project_tasks.project_id AS "projectId",
      projects.project_code AS "projectCode",
      projects.name AS "projectName",
      projects.project_manager_id AS "projectManagerId",
      project_tasks.task_code AS "taskCode",
      project_tasks.title,
      project_tasks.description,
      project_tasks.status,
      project_tasks.priority,
      project_tasks.assignee_id AS "assigneeId",
      assignee.full_name AS "assigneeName",
      assignee.email AS "assigneeEmail",
      assignee.role AS "assigneeRole",
      project_tasks.reporter_id AS "reporterId",
      project_tasks.due_date AS "dueDate",
      project_tasks.estimated_minutes AS "estimatedMinutes",
      project_tasks.spent_minutes AS "spentMinutes",
      project_tasks.progress_percent AS "progressPercent",
      project_tasks.blocked_reason AS "blockedReason",
      project_tasks.created_by AS "createdBy",
      project_tasks.created_at AS "createdAt",
      project_tasks.updated_at AS "updatedAt",
      project_tasks.completed_at AS "completedAt",
      project_tasks.archived_at AS "archivedAt"
    ${buildTaskFromSql()}
  `;
}

function buildAccessibleProjectCondition() {
  return `
    EXISTS (
      SELECT 1
      FROM projects AS visible_projects
      LEFT JOIN project_members AS visible_members
        ON visible_members.project_id = visible_projects.id
       AND visible_members.company_id = visible_projects.company_id
       AND visible_members.user_id = $2
       AND visible_members.is_active = TRUE
      WHERE visible_projects.id = project_tasks.project_id
        AND visible_projects.company_id = project_tasks.company_id
        AND visible_projects.archived_at IS NULL
        AND (
          visible_projects.project_manager_id = $2
          OR visible_members.user_id IS NOT NULL
        )
    )
  `;
}

function applyTaskFilters(args: ListTasksArgs, params: unknown[]) {
  const conditions = [
    "project_tasks.company_id = $1",
    "project_tasks.archived_at IS NULL",
    "projects.archived_at IS NULL",
    buildAccessibleProjectCondition(),
  ];

  if (args.projectId) {
    conditions.push(`project_tasks.project_id = $${params.push(args.projectId)}`);
  }

  if (args.assigneeId) {
    conditions.push(`project_tasks.assignee_id = $${params.push(args.assigneeId)}`);
  }

  if (args.status) {
    conditions.push(`project_tasks.status = $${params.push(args.status)}`);
  }

  if (args.priority) {
    conditions.push(`project_tasks.priority = $${params.push(args.priority)}`);
  }

  const search = args.search?.trim();

  if (search) {
    const pattern = `%${search}%`;

    conditions.push(
      `(project_tasks.task_code ILIKE $${params.push(pattern)} OR project_tasks.title ILIKE $${params.push(pattern)} OR projects.name ILIKE $${params.push(pattern)})`,
    );
  }

  if (args.dueDateFilter === "today") {
    conditions.push("project_tasks.due_date = CURRENT_DATE");
  } else if (args.dueDateFilter === "upcoming") {
    conditions.push("project_tasks.due_date >= CURRENT_DATE");
    conditions.push("project_tasks.status <> 'done'");
  } else if (args.dueDateFilter === "next-7-days") {
    conditions.push("project_tasks.due_date >= CURRENT_DATE");
    conditions.push("project_tasks.due_date <= CURRENT_DATE + INTERVAL '7 days'");
    conditions.push("project_tasks.status <> 'done'");
  } else if (args.dueDateFilter === "this-month") {
    conditions.push("project_tasks.due_date >= DATE_TRUNC('month', CURRENT_DATE)::date");
    conditions.push("project_tasks.due_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date");
  } else if (args.dueDateFilter === "overdue") {
    conditions.push("project_tasks.due_date < CURRENT_DATE");
    conditions.push("project_tasks.status <> 'done'");
  }

  return conditions;
}

function buildMilestoneFromSql() {
  return `
    FROM project_milestones
    INNER JOIN projects
      ON projects.id = project_milestones.project_id
     AND projects.company_id = project_milestones.company_id
    INNER JOIN users AS owner
      ON owner.id = project_milestones.owner_id
    LEFT JOIN users AS creator
      ON creator.id = project_milestones.created_by
  `;
}

function buildMilestoneSelectSql() {
  return `
    SELECT
      project_milestones.id AS "internalId",
      project_milestones.company_id AS "companyId",
      project_milestones.project_id AS "projectId",
      projects.project_code AS "projectCode",
      projects.name AS "projectName",
      projects.project_manager_id AS "projectManagerId",
      project_milestones.milestone_code AS "milestoneCode",
      project_milestones.title,
      project_milestones.description,
      project_milestones.milestone_type AS "milestoneType",
      project_milestones.phase,
      project_milestones.status,
      project_milestones.priority,
      project_milestones.owner_id AS "ownerId",
      owner.full_name AS "ownerName",
      owner.email AS "ownerEmail",
      owner.role AS "ownerRole",
      project_milestones.start_date AS "startDate",
      project_milestones.due_date AS "dueDate",
      project_milestones.target_completion_date AS "targetCompletionDate",
      project_milestones.completed_at AS "completedAt",
      project_milestones.progress_percent AS "progressPercent",
      project_milestones.baseline_progress AS "baselineProgress",
      project_milestones.completion_criteria AS "completionCriteria",
      project_milestones.created_by AS "createdBy",
      creator.full_name AS "createdByName",
      project_milestones.created_at AS "createdAt",
      project_milestones.updated_at AS "updatedAt",
      project_milestones.archived_at AS "archivedAt",
      (
        SELECT COUNT(*)::int
        FROM project_milestone_dependencies
        WHERE project_milestone_dependencies.company_id = project_milestones.company_id
          AND project_milestone_dependencies.milestone_id = project_milestones.id
      ) AS "dependencyCount",
      (
        SELECT COUNT(*)::int
        FROM project_milestone_attachments
        WHERE project_milestone_attachments.company_id = project_milestones.company_id
          AND project_milestone_attachments.milestone_id = project_milestones.id
      ) AS "fileCount"
    ${buildMilestoneFromSql()}
  `;
}

function buildAccessibleMilestoneProjectCondition() {
  return `
    EXISTS (
      SELECT 1
      FROM projects AS visible_projects
      LEFT JOIN project_members AS visible_members
        ON visible_members.project_id = visible_projects.id
       AND visible_members.company_id = visible_projects.company_id
       AND visible_members.user_id = $2
       AND visible_members.is_active = TRUE
      WHERE visible_projects.id = project_milestones.project_id
        AND visible_projects.company_id = project_milestones.company_id
        AND visible_projects.archived_at IS NULL
        AND (
          visible_projects.project_manager_id = $2
          OR visible_members.user_id IS NOT NULL
          OR project_milestones.owner_id = $2
        )
    )
  `;
}

function applyMilestoneFilters(args: ListMilestonesArgs, params: unknown[]) {
  const conditions = [
    "project_milestones.company_id = $1",
    "project_milestones.archived_at IS NULL",
    "projects.archived_at IS NULL",
    buildAccessibleMilestoneProjectCondition(),
  ];

  if (args.projectId) {
    conditions.push(`project_milestones.project_id = $${params.push(args.projectId)}`);
  }

  if (args.ownerId) {
    conditions.push(`project_milestones.owner_id = $${params.push(args.ownerId)}`);
  }

  if (args.status) {
    conditions.push(`project_milestones.status = $${params.push(args.status)}`);
  }

  if (args.priority) {
    conditions.push(`project_milestones.priority = $${params.push(args.priority)}`);
  }

  const search = args.search?.trim();

  if (search) {
    const pattern = `%${search}%`;

    conditions.push(
      `(project_milestones.milestone_code ILIKE $${params.push(pattern)} OR project_milestones.title ILIKE $${params.push(pattern)} OR projects.name ILIKE $${params.push(pattern)} OR owner.full_name ILIKE $${params.push(pattern)})`,
    );
  }

  if (args.dueDateFilter === "today") {
    conditions.push("project_milestones.due_date = CURRENT_DATE");
  } else if (args.dueDateFilter === "upcoming") {
    conditions.push("project_milestones.due_date >= CURRENT_DATE");
    conditions.push("project_milestones.completed_at IS NULL");
    conditions.push("project_milestones.status <> 'completed'");
  } else if (args.dueDateFilter === "next-7-days") {
    conditions.push("project_milestones.due_date >= CURRENT_DATE");
    conditions.push("project_milestones.due_date <= CURRENT_DATE + INTERVAL '7 days'");
    conditions.push("project_milestones.completed_at IS NULL");
    conditions.push("project_milestones.status <> 'completed'");
  } else if (args.dueDateFilter === "this-month") {
    conditions.push("project_milestones.due_date >= DATE_TRUNC('month', CURRENT_DATE)::date");
    conditions.push("project_milestones.due_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date");
  } else if (args.dueDateFilter === "overdue") {
    conditions.push("project_milestones.due_date < CURRENT_DATE");
    conditions.push("project_milestones.completed_at IS NULL");
    conditions.push("project_milestones.status <> 'completed'");
  }

  return conditions;
}

export const projectsRepository = {
  async ensureDefaultProjectWorkspace(
    input: DefaultProjectWorkspaceInput,
    executor?: DatabaseExecutor,
  ) {
    const db = resolveExecutor(executor);

    await db.query(
      "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
      [`project-task-workspace:${input.companyId}:${input.managerId}`],
    );

    const existingProject = await db.query<{ id: string }>(
      `
        SELECT id
        FROM projects
        WHERE company_id = $1
          AND project_manager_id = $2
          AND archived_at IS NULL
        ORDER BY created_at ASC, name ASC
        LIMIT 1
      `,
      [input.companyId, input.managerId],
    );
    let projectId = existingProject.rows[0]?.id ?? input.projectId;

    if (!existingProject.rows[0]) {
      const codeResult = await db.query<{ nextNumber: number }>(
        `
          SELECT COALESCE(
            MAX(
              CASE
                WHEN project_code ~ '^PRJ-[0-9]+$'
                THEN SUBSTRING(project_code FROM 5)::int
                ELSE NULL
              END
            ),
            1000
          ) + 1 AS "nextNumber"
          FROM projects
          WHERE company_id = $1
        `,
        [input.companyId],
      );
      const projectCode = `PRJ-${Number(codeResult.rows[0]?.nextNumber ?? 1001)}`;

      await db.query(
        `
          INSERT INTO projects (
            id,
            company_id,
            project_code,
            name,
            client_name,
            description,
            status,
            priority,
            start_date,
            due_date,
            progress_percent,
            project_manager_id,
            budget_amount,
            spent_amount,
            created_by,
            created_at,
            updated_at,
            archived_at
          ) VALUES (
            $1,
            $2,
            $3,
            'General Project',
            'Internal',
            'Default project created to back the Project Manager Tasks Board.',
            'on_track',
            'medium',
            CURRENT_DATE,
            CURRENT_DATE + INTERVAL '30 days',
            0,
            $4,
            NULL,
            NULL,
            $4,
            NOW(),
            NOW(),
            NULL
          )
        `,
        [projectId, input.companyId, projectCode, input.managerId],
      );
    }

    await db.query(
      `
        INSERT INTO project_members (
          id,
          company_id,
          project_id,
          user_id,
          role_label,
          allocation_percent,
          capacity_hours_per_week,
          is_active,
          joined_at,
          created_at,
          updated_at
        )
        SELECT
          CONCAT('pm-', md5($1 || ':' || $2 || ':' || users.id)),
          $1,
          $2,
          users.id,
          CASE
            WHEN users.id = $3 THEN 'Project Manager'
            ELSE INITCAP(REPLACE(users.role, '-', ' '))
          END,
          CASE WHEN users.id = $3 THEN 100 ELSE 50 END,
          NULL,
          TRUE,
          CURRENT_DATE,
          NOW(),
          NOW()
        FROM users
        WHERE users.company_id = $1
          AND users.is_active = TRUE
          AND users.suspended_at IS NULL
          AND users.role <> 'superadmin'
        ON CONFLICT (company_id, project_id, user_id)
        DO UPDATE SET
          is_active = TRUE,
          updated_at = NOW()
      `,
      [input.companyId, projectId, input.managerId],
    );

    return projectId;
  },

  async listAccessibleProjects(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectTaskProjectRow>(
      `
        SELECT DISTINCT
          projects.id,
          projects.project_code AS "projectCode",
          projects.name,
          projects.project_manager_id AS "projectManagerId",
          (projects.project_manager_id = $2) AS "isManager",
          EXISTS (
            SELECT 1
            FROM project_members
            WHERE project_members.company_id = projects.company_id
              AND project_members.project_id = projects.id
              AND project_members.user_id = $2
              AND project_members.is_active = TRUE
          ) AS "isMember"
        FROM projects
        LEFT JOIN project_members
          ON project_members.company_id = projects.company_id
         AND project_members.project_id = projects.id
         AND project_members.is_active = TRUE
        WHERE projects.company_id = $1
          AND projects.archived_at IS NULL
          AND (
            projects.project_manager_id = $2
            OR project_members.user_id = $2
          )
        ORDER BY projects.name ASC, projects.project_code ASC
      `,
      [companyId, userId],
    );

    return result.rows;
  },

  async findAccessibleProjectById(
    companyId: string,
    userId: string,
    projectId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectTaskProjectRow>(
      `
        SELECT
          projects.id,
          projects.project_code AS "projectCode",
          projects.name,
          projects.project_manager_id AS "projectManagerId",
          (projects.project_manager_id = $2) AS "isManager",
          EXISTS (
            SELECT 1
            FROM project_members
            WHERE project_members.company_id = projects.company_id
              AND project_members.project_id = projects.id
              AND project_members.user_id = $2
              AND project_members.is_active = TRUE
          ) AS "isMember"
        FROM projects
        WHERE projects.company_id = $1
          AND projects.id = $3
          AND projects.archived_at IS NULL
        LIMIT 1
      `,
      [companyId, userId, projectId],
    );

    const project = result.rows[0];

    if (!project || (!project.isManager && !project.isMember)) {
      return null;
    }

    return project;
  },

  async isActiveProjectMember(
    companyId: string,
    projectId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM project_members
          WHERE company_id = $1
            AND project_id = $2
            AND user_id = $3
            AND is_active = TRUE
        ) AS "exists"
      `,
      [companyId, projectId, userId],
    );

    return Boolean(result.rows[0]?.exists);
  },

  async listAssigneesForAccessibleProjects(
    companyId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectTaskAssigneeRow>(
      `
        WITH visible_projects AS (
          SELECT DISTINCT projects.id, projects.project_manager_id
          FROM projects
          LEFT JOIN project_members AS viewer_membership
            ON viewer_membership.company_id = projects.company_id
           AND viewer_membership.project_id = projects.id
           AND viewer_membership.user_id = $2
           AND viewer_membership.is_active = TRUE
          WHERE projects.company_id = $1
            AND projects.archived_at IS NULL
            AND (
              projects.project_manager_id = $2
              OR viewer_membership.user_id IS NOT NULL
            )
        ),
        assignee_ids AS (
          SELECT project_members.user_id
          FROM project_members
          INNER JOIN visible_projects
            ON visible_projects.id = project_members.project_id
          WHERE project_members.company_id = $1
            AND project_members.is_active = TRUE
        )
        SELECT DISTINCT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role
        FROM assignee_ids
        INNER JOIN users
          ON users.id = assignee_ids.user_id
        WHERE users.is_active = TRUE
        ORDER BY users.full_name ASC, users.email ASC
      `,
      [companyId, userId],
    );

    return result.rows;
  },

  async listProjectMembersForProjects(
    companyId: string,
    projectIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (projectIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectMemberRow>(
      `
        SELECT DISTINCT
          project_members.project_id AS "projectId",
          users.id AS "userId",
          users.full_name AS "fullName",
          users.role
        FROM project_members
        INNER JOIN users
          ON users.id = project_members.user_id
        WHERE project_members.company_id = $1
          AND project_members.project_id = ANY($2::text[])
          AND project_members.is_active = TRUE
          AND users.is_active = TRUE
        ORDER BY users.full_name ASC
      `,
      [companyId, projectIds],
    );

    return result.rows;
  },

  async listMilestones(args: ListMilestonesArgs, executor?: DatabaseExecutor) {
    const params: unknown[] = [args.companyId, args.userId];
    const whereConditions = applyMilestoneFilters(args, params);
    const whereSql = whereConditions.join("\n          AND ");
    const countResult = await resolveExecutor(executor).query<{ totalItems: number }>(
      `
        SELECT COUNT(*)::int AS "totalItems"
        ${buildMilestoneFromSql()}
        WHERE ${whereSql}
      `,
      params,
    );
    const totalItems = Number(countResult.rows[0]?.totalItems ?? 0);
    const limit =
      typeof args.limit === "number" && args.limit > 0
        ? Math.min(Math.round(args.limit), 100)
        : null;
    const requestedPage =
      typeof args.page === "number" && args.page > 0
        ? Math.max(Math.round(args.page), 1)
        : 1;
    const totalPages = limit ? Math.max(1, Math.ceil(totalItems / limit)) : 1;
    const page = limit ? Math.min(requestedPage, totalPages) : requestedPage;
    const listParams = [...params];
    const paginationSql = limit
      ? `
        LIMIT $${listParams.push(limit)}
        OFFSET $${listParams.push((page - 1) * limit)}
      `
      : "";
    const result = await resolveExecutor(executor).query<ProjectMilestoneRow>(
      `
        ${buildMilestoneSelectSql()}
        WHERE ${whereSql}
        ORDER BY
          CASE
            WHEN project_milestones.status = 'delayed' THEN 0
            WHEN project_milestones.status = 'at_risk' THEN 1
            ELSE 2
          END,
          CASE
            WHEN project_milestones.completed_at IS NULL
             AND project_milestones.due_date < CURRENT_DATE THEN 0
            ELSE 1
          END,
          project_milestones.due_date ASC,
          project_milestones.updated_at DESC
        ${paginationSql}
      `,
      listParams,
    );

    return {
      milestones: result.rows,
      pagination: {
        page,
        limit: limit ?? Math.max(totalItems, 1),
        totalItems,
        totalPages,
      },
    };
  },

  async findMilestoneById(
    companyId: string,
    userId: string,
    milestoneId: string,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [companyId, userId, milestoneId];
    const result = await resolveExecutor(executor).query<ProjectMilestoneRow>(
      `
        ${buildMilestoneSelectSql()}
        WHERE project_milestones.company_id = $1
          AND project_milestones.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND (project_milestones.id = $3 OR project_milestones.milestone_code = $3)
          AND ${buildAccessibleMilestoneProjectCondition()}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  },

  async getNextMilestoneCode(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<{ nextNumber: number }>(
      `
        SELECT
          COALESCE(
            MAX(NULLIF(REGEXP_REPLACE(milestone_code, '[^0-9]', '', 'g'), '')::int),
            1000
          ) + 1 AS "nextNumber"
        FROM project_milestones
        WHERE company_id = $1
      `,
      [companyId],
    );

    return `MS-${Number(result.rows[0]?.nextNumber ?? 1001)}`;
  },

  async createMilestone(input: MilestoneInsertInput, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO project_milestones (
          id,
          company_id,
          project_id,
          milestone_code,
          title,
          description,
          milestone_type,
          phase,
          status,
          priority,
          owner_id,
          start_date,
          due_date,
          target_completion_date,
          completed_at,
          progress_percent,
          baseline_progress,
          completion_criteria,
          created_by,
          created_at,
          updated_at,
          archived_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          CASE WHEN $9 = 'completed' THEN NOW() ELSE NULL END,
          $15, $16, $17, $18, NOW(), NOW(), NULL
        )
        RETURNING id
      `,
      [
        input.id,
        input.companyId,
        input.projectId,
        input.milestoneCode,
        input.title,
        input.description,
        input.milestoneType,
        input.phase,
        input.status,
        input.priority,
        input.ownerId,
        input.startDate,
        input.dueDate,
        input.targetCompletionDate,
        input.progressPercent,
        input.baselineProgress,
        input.completionCriteria,
        input.createdBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateMilestone(input: MilestoneUpdateInput, executor?: DatabaseExecutor) {
    const assignments = ["updated_at = NOW()"];
    const params: unknown[] = [input.companyId, input.milestoneId];

    if (input.title !== undefined) {
      assignments.push(`title = $${params.push(input.title)}`);
    }

    if (input.description !== undefined) {
      assignments.push(`description = $${params.push(input.description)}`);
    }

    if (input.milestoneType !== undefined) {
      assignments.push(`milestone_type = $${params.push(input.milestoneType)}`);
    }

    if (input.phase !== undefined) {
      assignments.push(`phase = $${params.push(input.phase)}`);
    }

    if (input.status !== undefined) {
      assignments.push(`status = $${params.push(input.status)}`);
    }

    if (input.priority !== undefined) {
      assignments.push(`priority = $${params.push(input.priority)}`);
    }

    if (input.ownerId !== undefined) {
      assignments.push(`owner_id = $${params.push(input.ownerId)}`);
    }

    if (input.startDate !== undefined) {
      assignments.push(`start_date = $${params.push(input.startDate)}`);
    }

    if (input.dueDate !== undefined) {
      assignments.push(`due_date = $${params.push(input.dueDate)}`);
    }

    if (input.targetCompletionDate !== undefined) {
      assignments.push(`target_completion_date = $${params.push(input.targetCompletionDate)}`);
    }

    if (input.completedAt !== undefined) {
      assignments.push(`completed_at = $${params.push(input.completedAt)}`);
    }

    if (input.progressPercent !== undefined) {
      assignments.push(`progress_percent = $${params.push(input.progressPercent)}`);
    }

    if (input.baselineProgress !== undefined) {
      assignments.push(`baseline_progress = $${params.push(input.baselineProgress)}`);
    }

    if (input.completionCriteria !== undefined) {
      assignments.push(`completion_criteria = $${params.push(input.completionCriteria)}`);
    }

    if (assignments.length === 1) {
      return false;
    }

    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_milestones
        SET ${assignments.join(", ")}
        WHERE company_id = $1
          AND (id = $2 OR milestone_code = $2)
          AND archived_at IS NULL
        RETURNING id
      `,
      params,
    );

    return Boolean(result.rows[0]?.id);
  },

  async archiveMilestone(
    companyId: string,
    milestoneId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_milestones
        SET archived_at = NOW(),
            updated_at = NOW()
        WHERE company_id = $1
          AND (id = $2 OR milestone_code = $2)
          AND archived_at IS NULL
        RETURNING id
      `,
      [companyId, milestoneId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async listMilestoneDependencies(
    companyId: string,
    milestoneIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (milestoneIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectMilestoneDependencyRow>(
      `
        SELECT
          project_milestone_dependencies.id,
          project_milestone_dependencies.milestone_id AS "milestoneId",
          project_milestone_dependencies.depends_on_milestone_id AS "dependsOnMilestoneId",
          project_milestone_dependencies.dependency_type AS "dependencyType",
          dependency.milestone_code AS "dependsOnCode",
          dependency.title AS "dependsOnTitle",
          dependency.status AS "dependsOnStatus",
          dependency.due_date AS "dependsOnDueDate",
          project_milestone_dependencies.created_at AS "createdAt"
        FROM project_milestone_dependencies
        INNER JOIN project_milestones AS dependency
          ON dependency.id = project_milestone_dependencies.depends_on_milestone_id
         AND dependency.company_id = project_milestone_dependencies.company_id
        WHERE project_milestone_dependencies.company_id = $1
          AND project_milestone_dependencies.milestone_id = ANY($2::text[])
          AND dependency.archived_at IS NULL
        ORDER BY project_milestone_dependencies.created_at DESC
      `,
      [companyId, milestoneIds],
    );

    return result.rows;
  },

  async addMilestoneDependency(
    input: {
      id: string;
      companyId: string;
      milestoneId: string;
      dependsOnMilestoneId: string;
      dependencyType: ProjectMilestoneDependencyType;
      createdBy: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectMilestoneDependencyRow>(
      `
        INSERT INTO project_milestone_dependencies (
          id,
          company_id,
          milestone_id,
          depends_on_milestone_id,
          dependency_type,
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING
          id,
          milestone_id AS "milestoneId",
          depends_on_milestone_id AS "dependsOnMilestoneId",
          dependency_type AS "dependencyType",
          (
            SELECT milestone_code
            FROM project_milestones
            WHERE id = $4 AND company_id = $2
          ) AS "dependsOnCode",
          (
            SELECT title
            FROM project_milestones
            WHERE id = $4 AND company_id = $2
          ) AS "dependsOnTitle",
          (
            SELECT status
            FROM project_milestones
            WHERE id = $4 AND company_id = $2
          ) AS "dependsOnStatus",
          (
            SELECT due_date
            FROM project_milestones
            WHERE id = $4 AND company_id = $2
          ) AS "dependsOnDueDate",
          created_at AS "createdAt"
      `,
      [
        input.id,
        input.companyId,
        input.milestoneId,
        input.dependsOnMilestoneId,
        input.dependencyType,
        input.createdBy,
      ],
    );

    return result.rows[0] ?? null;
  },

  async removeMilestoneDependency(
    companyId: string,
    milestoneId: string,
    dependencyId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectMilestoneDependencyRow>(
      `
        DELETE FROM project_milestone_dependencies
        WHERE company_id = $1
          AND milestone_id = $2
          AND id = $3
        RETURNING
          id,
          milestone_id AS "milestoneId",
          depends_on_milestone_id AS "dependsOnMilestoneId",
          dependency_type AS "dependencyType",
          ''::text AS "dependsOnCode",
          ''::text AS "dependsOnTitle",
          'upcoming'::text AS "dependsOnStatus",
          CURRENT_DATE AS "dependsOnDueDate",
          created_at AS "createdAt"
      `,
      [companyId, milestoneId, dependencyId],
    );

    return result.rows[0] ?? null;
  },

  async dependencyExists(
    companyId: string,
    milestoneId: string,
    dependsOnMilestoneId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM project_milestone_dependencies
          WHERE company_id = $1
            AND milestone_id = $2
            AND depends_on_milestone_id = $3
        ) AS "exists"
      `,
      [companyId, milestoneId, dependsOnMilestoneId],
    );

    return Boolean(result.rows[0]?.exists);
  },

  async listTasksForMilestones(
    companyId: string,
    milestoneIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (milestoneIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectMilestoneLinkedTaskRow>(
      `
        SELECT
          id AS "internalId",
          milestone_id AS "milestoneId",
          task_code AS "taskCode",
          title,
          status,
          priority,
          due_date AS "dueDate",
          progress_percent AS "progressPercent"
        FROM project_tasks
        WHERE company_id = $1
          AND milestone_id = ANY($2::text[])
          AND archived_at IS NULL
        ORDER BY due_date ASC, updated_at DESC
      `,
      [companyId, milestoneIds],
    );

    return result.rows;
  },

  async linkTaskToMilestone(
    companyId: string,
    projectId: string,
    milestoneId: string,
    taskId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_tasks
        SET milestone_id = $3,
            updated_at = NOW()
        WHERE company_id = $1
          AND project_id = $2
          AND (id = $4 OR task_code = $4)
          AND archived_at IS NULL
        RETURNING id
      `,
      [companyId, projectId, milestoneId, taskId],
    );

    return result.rows[0]?.id ?? null;
  },

  async unlinkTaskFromMilestone(
    companyId: string,
    projectId: string,
    milestoneId: string,
    taskId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_tasks
        SET milestone_id = NULL,
            updated_at = NOW()
        WHERE company_id = $1
          AND project_id = $2
          AND milestone_id = $3
          AND (id = $4 OR task_code = $4)
          AND archived_at IS NULL
        RETURNING id
      `,
      [companyId, projectId, milestoneId, taskId],
    );

    return result.rows[0]?.id ?? null;
  },

  async listMilestoneActivityLogs(
    companyId: string,
    milestoneIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (milestoneIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectMilestoneActivityRow>(
      `
        SELECT
          project_milestone_activity_logs.id,
          project_milestone_activity_logs.milestone_id AS "milestoneId",
          project_milestone_activity_logs.actor_id AS "actorId",
          users.full_name AS "actorName",
          project_milestone_activity_logs.activity_type AS "activityType",
          project_milestone_activity_logs.old_value AS "oldValue",
          project_milestone_activity_logs.new_value AS "newValue",
          project_milestone_activity_logs.metadata,
          project_milestone_activity_logs.created_at AS "createdAt"
        FROM project_milestone_activity_logs
        LEFT JOIN users
          ON users.id = project_milestone_activity_logs.actor_id
        WHERE project_milestone_activity_logs.company_id = $1
          AND project_milestone_activity_logs.milestone_id = ANY($2::text[])
        ORDER BY project_milestone_activity_logs.created_at DESC
      `,
      [companyId, milestoneIds],
    );

    return result.rows;
  },

  async createMilestoneActivityLog(
    input: {
      id: string;
      companyId: string;
      milestoneId: string;
      actorId: string;
      activityType: string;
      oldValue?: string | null;
      newValue?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        INSERT INTO project_milestone_activity_logs (
          id,
          company_id,
          milestone_id,
          actor_id,
          activity_type,
          old_value,
          new_value,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      `,
      [
        input.id,
        input.companyId,
        input.milestoneId,
        input.actorId,
        input.activityType,
        input.oldValue ?? null,
        input.newValue ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  },

  async listMilestoneAttachments(
    companyId: string,
    milestoneIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (milestoneIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectMilestoneAttachmentRow>(
      `
        SELECT
          project_milestone_attachments.id,
          project_milestone_attachments.milestone_id AS "milestoneId",
          project_milestone_attachments.document_id AS "documentId",
          documents.name AS "documentName",
          documents.type AS "documentType",
          documents.file_name AS "fileName",
          documents.mime_type AS "mimeType",
          documents.size_bytes AS "sizeBytes",
          project_milestone_attachments.created_at AS "uploadedAt"
        FROM project_milestone_attachments
        INNER JOIN documents
          ON documents.id = project_milestone_attachments.document_id
         AND documents.company_id = project_milestone_attachments.company_id
         AND documents.deleted_at IS NULL
        WHERE project_milestone_attachments.company_id = $1
          AND project_milestone_attachments.milestone_id = ANY($2::text[])
        ORDER BY project_milestone_attachments.created_at DESC
      `,
      [companyId, milestoneIds],
    );

    return result.rows;
  },

  async listTasks(args: ListTasksArgs, executor?: DatabaseExecutor) {
    const params: unknown[] = [args.companyId, args.userId];
    const whereConditions = applyTaskFilters(args, params);
    const whereSql = whereConditions.join("\n          AND ");
    const countResult = await resolveExecutor(executor).query<{ totalItems: number }>(
      `
        SELECT COUNT(*)::int AS "totalItems"
        ${buildTaskFromSql()}
        WHERE ${whereSql}
      `,
      params,
    );
    const totalItems = Number(countResult.rows[0]?.totalItems ?? 0);
    const limit =
      typeof args.limit === "number" && args.limit > 0
        ? Math.min(Math.round(args.limit), 100)
        : null;
    const requestedPage =
      typeof args.page === "number" && args.page > 0
        ? Math.max(Math.round(args.page), 1)
        : 1;
    const totalPages = limit ? Math.max(1, Math.ceil(totalItems / limit)) : 1;
    const page = limit ? Math.min(requestedPage, totalPages) : requestedPage;
    const listParams = [...params];
    const paginationSql = limit
      ? `
        LIMIT $${listParams.push(limit)}
        OFFSET $${listParams.push((page - 1) * limit)}
      `
      : "";
    const result = await resolveExecutor(executor).query<ProjectTaskRow>(
      `
        ${buildTaskSelectSql()}
        WHERE ${whereSql}
        ORDER BY
          CASE WHEN project_tasks.status = 'blocked' THEN 0 ELSE 1 END,
          CASE
            WHEN project_tasks.status <> 'done'
             AND project_tasks.due_date < CURRENT_DATE THEN 0
            ELSE 1
          END,
          project_tasks.due_date ASC,
          project_tasks.updated_at DESC
        ${paginationSql}
      `,
      listParams,
    );

    return {
      tasks: result.rows,
      pagination: {
        page,
        limit: limit ?? Math.max(totalItems, 1),
        totalItems,
        totalPages,
      },
    };
  },

  async findTaskById(
    companyId: string,
    userId: string,
    taskId: string,
    executor?: DatabaseExecutor,
  ) {
    const params: unknown[] = [companyId, userId, taskId];
    const result = await resolveExecutor(executor).query<ProjectTaskRow>(
      `
        ${buildTaskSelectSql()}
        WHERE project_tasks.company_id = $1
          AND project_tasks.archived_at IS NULL
          AND projects.archived_at IS NULL
          AND (project_tasks.id = $3 OR project_tasks.task_code = $3)
          AND ${buildAccessibleProjectCondition()}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  },

  async getNextTaskCode(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<{ nextNumber: number }>(
      `
        SELECT
          COALESCE(
            MAX(NULLIF(REGEXP_REPLACE(task_code, '[^0-9]', '', 'g'), '')::int),
            1000
          ) + 1 AS "nextNumber"
        FROM project_tasks
        WHERE company_id = $1
      `,
      [companyId],
    );

    return `TSK-${Number(result.rows[0]?.nextNumber ?? 1001)}`;
  },

  async createTask(input: TaskInsertInput, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO project_tasks (
          id,
          company_id,
          project_id,
          task_code,
          title,
          description,
          status,
          priority,
          assignee_id,
          reporter_id,
          due_date,
          estimated_minutes,
          spent_minutes,
          progress_percent,
          blocked_reason,
          created_by,
          created_at,
          updated_at,
          completed_at,
          archived_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, NOW(), NOW(),
          CASE WHEN $7 = 'done' THEN NOW() ELSE NULL END,
          NULL
        )
        RETURNING id
      `,
      [
        input.id,
        input.companyId,
        input.projectId,
        input.taskCode,
        input.title,
        input.description,
        input.status,
        input.priority,
        input.assigneeId,
        input.reporterId,
        input.dueDate,
        input.estimatedMinutes,
        input.spentMinutes,
        input.progressPercent,
        input.blockedReason,
        input.createdBy,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateTask(input: TaskUpdateInput, executor?: DatabaseExecutor) {
    const assignments = ["updated_at = NOW()"];
    const params: unknown[] = [input.companyId, input.taskId];

    if (input.title !== undefined) {
      assignments.push(`title = $${params.push(input.title)}`);
    }

    if (input.description !== undefined) {
      assignments.push(`description = $${params.push(input.description)}`);
    }

    if (input.status !== undefined) {
      assignments.push(`status = $${params.push(input.status)}`);
    }

    if (input.priority !== undefined) {
      assignments.push(`priority = $${params.push(input.priority)}`);
    }

    if (input.assigneeId !== undefined) {
      assignments.push(`assignee_id = $${params.push(input.assigneeId)}`);
    }

    if (input.dueDate !== undefined) {
      assignments.push(`due_date = $${params.push(input.dueDate)}`);
    }

    if (input.estimatedMinutes !== undefined) {
      assignments.push(`estimated_minutes = $${params.push(input.estimatedMinutes)}`);
    }

    if (input.spentMinutes !== undefined) {
      assignments.push(`spent_minutes = $${params.push(input.spentMinutes)}`);
    }

    if (input.progressPercent !== undefined) {
      assignments.push(`progress_percent = $${params.push(input.progressPercent)}`);
    }

    if (input.blockedReason !== undefined) {
      assignments.push(`blocked_reason = $${params.push(input.blockedReason)}`);
    }

    if (input.completedAt !== undefined) {
      assignments.push(`completed_at = $${params.push(input.completedAt)}`);
    }

    if (assignments.length === 1) {
      return false;
    }

    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_tasks
        SET ${assignments.join(", ")}
        WHERE company_id = $1
          AND (id = $2 OR task_code = $2)
          AND archived_at IS NULL
        RETURNING id
      `,
      params,
    );

    return Boolean(result.rows[0]?.id);
  },

  async archiveTask(
    companyId: string,
    taskId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE project_tasks
        SET archived_at = NOW(),
            updated_at = NOW()
        WHERE company_id = $1
          AND (id = $2 OR task_code = $2)
          AND archived_at IS NULL
        RETURNING id
      `,
      [companyId, taskId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async createChecklistItem(
    input: {
      id: string;
      companyId: string;
      taskId: string;
      title: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectTaskChecklistRow>(
      `
        INSERT INTO project_task_checklist_items (
          id,
          company_id,
          task_id,
          title,
          is_completed,
          completed_by,
          completed_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, FALSE, NULL, NULL, NOW(), NOW())
        RETURNING
          id,
          task_id AS "taskId",
          title,
          is_completed AS "isCompleted",
          completed_by AS "completedBy",
          completed_at AS "completedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [input.id, input.companyId, input.taskId, input.title],
    );

    return result.rows[0] ?? null;
  },

  async updateChecklistItem(
    input: {
      companyId: string;
      taskId: string;
      itemId: string;
      actorId: string;
      title?: string;
      completed?: boolean;
    },
    executor?: DatabaseExecutor,
  ) {
    const assignments = ["updated_at = NOW()"];
    const params: unknown[] = [input.companyId, input.taskId, input.itemId];

    if (input.title !== undefined) {
      assignments.push(`title = $${params.push(input.title)}`);
    }

    if (input.completed !== undefined) {
      assignments.push(`is_completed = $${params.push(input.completed)}`);
      assignments.push(
        `completed_by = CASE WHEN $${params.length}::boolean = TRUE THEN $${params.push(input.actorId)} ELSE NULL END`,
      );
      assignments.push(
        `completed_at = CASE WHEN $${params.length - 1}::boolean = TRUE THEN NOW() ELSE NULL END`,
      );
    }

    if (assignments.length === 1) {
      return null;
    }

    const result = await resolveExecutor(executor).query<ProjectTaskChecklistRow>(
      `
        UPDATE project_task_checklist_items
        SET ${assignments.join(", ")}
        WHERE company_id = $1
          AND task_id = $2
          AND id = $3
        RETURNING
          id,
          task_id AS "taskId",
          title,
          is_completed AS "isCompleted",
          completed_by AS "completedBy",
          completed_at AS "completedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      params,
    );

    return result.rows[0] ?? null;
  },

  async deleteChecklistItem(
    companyId: string,
    taskId: string,
    itemId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        DELETE FROM project_task_checklist_items
        WHERE company_id = $1
          AND task_id = $2
          AND id = $3
        RETURNING id
      `,
      [companyId, taskId, itemId],
    );

    return Boolean(result.rows[0]?.id);
  },

  async replaceChecklistItems(
    input: {
      companyId: string;
      taskId: string;
      items: Array<{ id: string; title: string; isCompleted: boolean }>;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = resolveExecutor(executor);

    await db.query(
      `
        DELETE FROM project_task_checklist_items
        WHERE company_id = $1
          AND task_id = $2
      `,
      [input.companyId, input.taskId],
    );

    for (const item of input.items) {
      await db.query(
        `
          INSERT INTO project_task_checklist_items (
            id,
            company_id,
            task_id,
            title,
            is_completed,
            completed_by,
            completed_at,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, NOW(), NOW())
        `,
        [item.id, input.companyId, input.taskId, item.title, item.isCompleted],
      );
    }
  },

  async createComment(
    input: {
      id: string;
      companyId: string;
      taskId: string;
      userId: string;
      comment: string;
      parentCommentId: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ProjectTaskCommentRow>(
      `
        INSERT INTO project_task_comments (
          id,
          company_id,
          task_id,
          user_id,
          comment,
          parent_comment_id,
          created_at,
          updated_at,
          deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NULL)
        RETURNING
          id,
          task_id AS "taskId",
          user_id AS "userId",
          (SELECT full_name FROM users WHERE users.id = $4) AS "authorName",
          comment,
          parent_comment_id AS "parentCommentId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        input.id,
        input.companyId,
        input.taskId,
        input.userId,
        input.comment,
        input.parentCommentId,
      ],
    );

    return result.rows[0] ?? null;
  },

  async listChecklistItems(
    companyId: string,
    taskIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (taskIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectTaskChecklistRow>(
      `
        SELECT
          id,
          task_id AS "taskId",
          title,
          is_completed AS "isCompleted",
          completed_by AS "completedBy",
          completed_at AS "completedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM project_task_checklist_items
        WHERE company_id = $1
          AND task_id = ANY($2::text[])
        ORDER BY created_at ASC, title ASC
      `,
      [companyId, taskIds],
    );

    return result.rows;
  },

  async listComments(
    companyId: string,
    taskIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (taskIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectTaskCommentRow>(
      `
        SELECT
          project_task_comments.id,
          project_task_comments.task_id AS "taskId",
          project_task_comments.user_id AS "userId",
          users.full_name AS "authorName",
          project_task_comments.comment,
          project_task_comments.parent_comment_id AS "parentCommentId",
          project_task_comments.created_at AS "createdAt",
          project_task_comments.updated_at AS "updatedAt"
        FROM project_task_comments
        LEFT JOIN users
          ON users.id = project_task_comments.user_id
        WHERE project_task_comments.company_id = $1
          AND project_task_comments.task_id = ANY($2::text[])
          AND project_task_comments.deleted_at IS NULL
        ORDER BY project_task_comments.created_at ASC
      `,
      [companyId, taskIds],
    );

    return result.rows;
  },

  async listActivityLogs(
    companyId: string,
    taskIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (taskIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectTaskActivityRow>(
      `
        SELECT
          project_task_activity_logs.id,
          project_task_activity_logs.task_id AS "taskId",
          project_task_activity_logs.actor_id AS "actorId",
          users.full_name AS "actorName",
          project_task_activity_logs.activity_type AS "activityType",
          project_task_activity_logs.old_value AS "oldValue",
          project_task_activity_logs.new_value AS "newValue",
          project_task_activity_logs.metadata,
          project_task_activity_logs.created_at AS "createdAt"
        FROM project_task_activity_logs
        LEFT JOIN users
          ON users.id = project_task_activity_logs.actor_id
        WHERE project_task_activity_logs.company_id = $1
          AND project_task_activity_logs.task_id = ANY($2::text[])
        ORDER BY project_task_activity_logs.created_at DESC
      `,
      [companyId, taskIds],
    );

    return result.rows;
  },

  async listAttachments(
    companyId: string,
    taskIds: readonly string[],
    executor?: DatabaseExecutor,
  ) {
    if (taskIds.length === 0) {
      return [];
    }

    const result = await resolveExecutor(executor).query<ProjectTaskAttachmentRow>(
      `
        SELECT
          project_task_attachments.id,
          project_task_attachments.task_id AS "taskId",
          project_task_attachments.document_id AS "documentId",
          documents.name AS "documentName",
          documents.type AS "documentType",
          documents.file_name AS "fileName",
          documents.mime_type AS "mimeType",
          documents.size_bytes AS "sizeBytes",
          project_task_attachments.created_at AS "uploadedAt"
        FROM project_task_attachments
        INNER JOIN documents
          ON documents.id = project_task_attachments.document_id
         AND documents.company_id = project_task_attachments.company_id
         AND documents.deleted_at IS NULL
        WHERE project_task_attachments.company_id = $1
          AND project_task_attachments.task_id = ANY($2::text[])
        ORDER BY project_task_attachments.created_at DESC
      `,
      [companyId, taskIds],
    );

    return result.rows;
  },

  async createActivityLog(
    input: {
      id: string;
      companyId: string;
      taskId: string;
      actorId: string;
      activityType: string;
      oldValue?: string | null;
      newValue?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        INSERT INTO project_task_activity_logs (
          id,
          company_id,
          task_id,
          actor_id,
          activity_type,
          old_value,
          new_value,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      `,
      [
        input.id,
        input.companyId,
        input.taskId,
        input.actorId,
        input.activityType,
        input.oldValue ?? null,
        input.newValue ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  },

  async refreshProjectDeliveryState(
    companyId: string,
    projectId: string,
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        WITH task_stats AS (
          SELECT
            COUNT(*)::int AS total_tasks,
            COUNT(*) FILTER (WHERE status = 'done')::int AS done_tasks,
            COUNT(*) FILTER (
              WHERE status = 'blocked'
                 OR (
                   priority = 'high'
                   AND due_date < CURRENT_DATE
                   AND status <> 'done'
                 )
            )::int AS risk_tasks
          FROM project_tasks
          WHERE company_id = $1
            AND project_id = $2
            AND archived_at IS NULL
        ),
        milestone_stats AS (
          SELECT
            COUNT(*)::int AS total_milestones,
            COUNT(*) FILTER (WHERE status = 'completed' OR completed_at IS NOT NULL)::int AS completed_milestones,
            COUNT(*) FILTER (
              WHERE status IN ('delayed', 'at_risk')
                 OR (
                   due_date < CURRENT_DATE
                   AND completed_at IS NULL
                   AND status <> 'completed'
                 )
            )::int AS risk_milestones
          FROM project_milestones
          WHERE company_id = $1
            AND project_id = $2
            AND archived_at IS NULL
        )
        UPDATE projects
        SET
          progress_percent = CASE
            WHEN task_stats.total_tasks > 0 THEN ROUND((task_stats.done_tasks::numeric / task_stats.total_tasks::numeric) * 100)::int
            WHEN milestone_stats.total_milestones > 0 THEN ROUND((milestone_stats.completed_milestones::numeric / milestone_stats.total_milestones::numeric) * 100)::int
            ELSE projects.progress_percent
          END,
          status = CASE
            WHEN projects.status IN ('completed', 'on_hold', 'archived') THEN projects.status
            WHEN task_stats.risk_tasks > 0 OR milestone_stats.risk_milestones > 0 THEN 'at_risk'
            WHEN projects.status = 'at_risk' THEN 'on_track'
            WHEN projects.status = 'not_started'
             AND (task_stats.total_tasks > 0 OR milestone_stats.total_milestones > 0) THEN 'on_track'
            ELSE projects.status
          END,
          updated_at = NOW()
        FROM task_stats, milestone_stats
        WHERE projects.company_id = $1
          AND projects.id = $2
          AND projects.archived_at IS NULL
      `,
      [companyId, projectId],
    );
  },

  async refreshProjectMilestonesFromTasks(
    companyId: string,
    projectId: string,
    executor?: DatabaseExecutor,
  ) {
    await resolveExecutor(executor).query(
      `
        WITH linked_task_stats AS (
          SELECT
            milestone_id,
            COUNT(*)::int AS total_tasks,
            COUNT(*) FILTER (WHERE status = 'done')::int AS done_tasks,
            COUNT(*) FILTER (
              WHERE status = 'blocked'
                 OR (
                   priority = 'high'
                   AND due_date < CURRENT_DATE
                   AND status <> 'done'
                 )
            )::int AS risk_tasks
          FROM project_tasks
          WHERE company_id = $1
            AND project_id = $2
            AND archived_at IS NULL
            AND milestone_id IS NOT NULL
          GROUP BY milestone_id
        )
        UPDATE project_milestones
        SET
          progress_percent = ROUND((linked_task_stats.done_tasks::numeric / linked_task_stats.total_tasks::numeric) * 100)::int,
          status = CASE
            WHEN project_milestones.status = 'cancelled' THEN project_milestones.status
            WHEN project_milestones.completed_at IS NOT NULL THEN 'completed'
            WHEN project_milestones.due_date < CURRENT_DATE THEN 'delayed'
            WHEN linked_task_stats.risk_tasks > 0 THEN 'at_risk'
            WHEN project_milestones.start_date IS NOT NULL
             AND project_milestones.start_date > CURRENT_DATE THEN 'upcoming'
            ELSE 'on_track'
          END,
          completed_at = CASE
            WHEN linked_task_stats.total_tasks > 0
             AND linked_task_stats.done_tasks = linked_task_stats.total_tasks
             AND project_milestones.completed_at IS NULL
            THEN NOW()
            ELSE project_milestones.completed_at
          END,
          updated_at = NOW()
        FROM linked_task_stats
        WHERE project_milestones.company_id = $1
          AND project_milestones.project_id = $2
          AND project_milestones.id = linked_task_stats.milestone_id
          AND project_milestones.archived_at IS NULL
      `,
      [companyId, projectId],
    );
  },
};
