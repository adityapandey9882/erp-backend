import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { attendanceRepository } from "../attendance/attendance.repository.js";
import type { HrAttendanceEntry } from "../attendance/attendance.types.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { withTransaction, type DatabaseExecutor } from "../../database/index.js";
import {
  approvalsRepository,
  approvalsService,
  canUserActOnApprovalStep,
  resolveCurrentApprovalStep,
} from "../approvals/approvals.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { leaveRepository } from "../leave/leave.repository.js";
import type { HrLeaveEntry, LeaveEmployeeSummary } from "../leave/leave.types.js";
import { ROLE_DEFINITIONS } from "../roles/roles.types.js";
import { usersRepository } from "../users/users.repository.js";
import type { CompanyUserProfile } from "../users/users.types.js";
import {
  projectsRepository,
  type ProjectMemberRow,
  type ProjectMilestoneActivityRow,
  type ProjectMilestoneAttachmentRow,
  type ProjectMilestoneDependencyRow,
  type ProjectMilestoneLinkedTaskRow,
  type ProjectMilestoneRow,
  type ProjectTaskActivityRow,
  type ProjectTaskAttachmentRow,
  type ProjectTaskChecklistRow,
  type ProjectTaskCommentRow,
  type ProjectTaskRow,
} from "./projects.repository.js";
import type {
  CreateProjectTaskChecklistItemRequest,
  CreateProjectTaskCommentRequest,
  CreateProjectTaskRequest,
  CompleteProjectMilestoneRequest,
  CreateProjectMilestoneDependencyRequest,
  CreateProjectMilestoneRequest,
  ManagerAttendanceResponse,
  ManagerLeaveMutationResponse,
  ManagerLeaveResponse,
  ManagerServiceResult,
  ManagerTeamResponse,
  ManagerViewerProfile,
  ManagerWorkspaceResponse,
  ManagerWorkspaceScope,
  ProjectManagerTaskActivity,
  ProjectManagerTaskAssignee,
  ProjectManagerTaskBoardColumnResponse,
  ProjectManagerTaskBoardPermissions,
  ProjectManagerTaskBoardResponse,
  ProjectManagerTaskChecklistItem,
  ProjectManagerTaskChecklistMutationResponse,
  ProjectManagerTaskComment,
  ProjectManagerTaskCommentMutationResponse,
  ProjectManagerTaskCommentsResponse,
  ProjectManagerTaskDetailsResponse,
  ProjectManagerTaskFile,
  ProjectManagerTaskMutationResponse,
  ProjectManagerTaskPriorityLabel,
  ProjectManagerTaskProject,
  ProjectManagerTaskRecord,
  ProjectManagerTaskStatusLabel,
  ProjectManagerTaskSummary,
  ProjectManagerMilestoneActivity,
  ProjectManagerMilestoneActivityResponse,
  ProjectManagerMilestoneDependenciesResponse,
  ProjectManagerMilestoneDependency,
  ProjectManagerMilestoneDetailsResponse,
  ProjectManagerMilestoneFile,
  ProjectManagerMilestoneLinkedTask,
  ProjectManagerMilestoneListResponse,
  ProjectManagerMilestoneMutationResponse,
  ProjectManagerMilestoneOwner,
  ProjectManagerMilestonePermissions,
  ProjectManagerMilestonePriorityLabel,
  ProjectManagerMilestoneProject,
  ProjectManagerMilestoneRecord,
  ProjectManagerMilestoneStatusLabel,
  ProjectManagerMilestoneSummary,
  ProjectManagerMilestoneTasksResponse,
  ProjectManagerMilestoneTypeLabel,
  ProjectMilestoneDueDateFilter,
  ProjectMilestonePriority,
  ProjectMilestoneStatus,
  ProjectMilestoneView,
  ProjectTaskDueDateFilter,
  ProjectTaskPriority,
  ProjectTaskStatus,
  UpdateProjectMilestoneRequest,
  UpdateProjectTaskChecklistItemRequest,
  UpdateProjectTaskRequest,
  UpdateManagerProjectLeaveStatusRequest,
} from "./projects.types.js";

function ok<T>(data: T): ManagerServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): ManagerServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function resolveDepartmentId(profile: CompanyUserProfile | null) {
  return profile?.department?.id ?? profile?.designation?.department?.id ?? null;
}

function toViewerProfile(profile: CompanyUserProfile): ManagerViewerProfile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    roleLabel: ROLE_DEFINITIONS[profile.role].label,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
  };
}

function toEmployeeSummary(profile: CompanyUserProfile): LeaveEmployeeSummary {
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
  };
}

function isAwaitingManagerReview(
  entry: HrLeaveEntry,
  viewerRole: string,
) {
  const currentStep = resolveCurrentApprovalStep(entry.approvalProgress ?? null);

  if (currentStep) {
    return (
      entry.status === "pending" &&
      canUserActOnApprovalStep(viewerRole, currentStep.role)
    );
  }

  return entry.status === "pending" && entry.managerReview.status === "pending";
}

type ManagerContext = {
  company: NonNullable<Awaited<ReturnType<typeof companiesService.getCompanyView>>>;
  viewer: CompanyUserProfile;
  scope: ManagerWorkspaceScope;
  teamMembers: CompanyUserProfile[];
};

async function ensureManagerContext(
  user: AuthenticatedUser,
): Promise<ManagerServiceResult<ManagerContext>> {
  if (!user.companyId) {
    return fail(403, "Your account is not assigned to a company context.");
  }

  const [company, viewer, companyUsers] = await Promise.all([
    companiesService.getCompanyView(user.companyId),
    usersRepository.findCompanyUserProfileById(user.companyId, user.id),
    usersRepository.listCompanyUserProfiles(user.companyId),
  ]);

  if (!company) {
    return fail(404, "Company not found.");
  }

  if (!viewer) {
    return fail(404, "Manager profile not found.");
  }

  const departmentId = resolveDepartmentId(viewer);

  if (!departmentId) {
    return ok({
      company,
      viewer,
      scope: {
        mode: "unassigned",
        label:
          "Assign this manager to a department before team visibility and approvals can be resolved safely.",
        department: null,
      },
      teamMembers: [],
    });
  }

  const teamMembers = companyUsers.filter((member) => {
    if (member.id === viewer.id) {
      return false;
    }

    if (member.role !== "employee") {
      return false;
    }

    return resolveDepartmentId(member) === departmentId;
  });

  return ok({
    company,
    viewer,
    scope: {
      mode: "department",
      label:
        viewer.department?.name ??
        viewer.designation?.department?.name ??
        "Department scope",
      department:
        viewer.department ??
        viewer.designation?.department ??
        null,
    },
    teamMembers,
  });
}

async function buildAttendanceEntries(
  companyId: string,
  teamMembers: readonly CompanyUserProfile[],
) {
  if (teamMembers.length === 0) {
    return {
      currentDate: await attendanceRepository.getCurrentDate(),
      items: [] as HrAttendanceEntry[],
    };
  }

  const [records, currentDate] = await Promise.all([
    attendanceRepository.listCompanyAttendanceRecords(companyId),
    attendanceRepository.getCurrentDate(),
  ]);
  const teamLookup = new Map(teamMembers.map((member) => [member.id, member]));

  const items = records
    .map((record) => {
      const employee = teamLookup.get(record.userId);

      if (!employee) {
        return null;
      }

      return {
        ...record,
        employee: toEmployeeSummary(employee),
      } satisfies HrAttendanceEntry;
    })
    .filter((entry): entry is HrAttendanceEntry => entry !== null);

  return {
    currentDate,
    items,
  };
}

async function buildLeaveEntries(
  companyId: string,
  teamMembers: readonly CompanyUserProfile[],
  viewerRole: string,
) {
  if (teamMembers.length === 0) {
    return {
      items: [] as HrLeaveEntry[],
      approvalQueue: [] as HrLeaveEntry[],
    };
  }

  const requests = await leaveRepository.listCompanyLeaveRequests(companyId);
  const teamLookup = new Map(teamMembers.map((member) => [member.id, member]));

  const items = requests
    .map((request) => {
      const employee = teamLookup.get(request.userId);

      if (!employee) {
        return null;
      }

      return {
        ...request,
        employee: toEmployeeSummary(employee),
      } satisfies HrLeaveEntry;
    })
    .filter((entry): entry is HrLeaveEntry => entry !== null);
  const itemsWithProgress = await approvalsService.attachLeaveApprovalProgress(
    companyId,
    items,
  );

  return {
    items: itemsWithProgress,
    approvalQueue: itemsWithProgress.filter((entry) =>
      isAwaitingManagerReview(entry, viewerRole),
    ),
  };
}

type ProjectTaskQuery = {
  projectId?: string | null;
  assigneeId?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDateFilter?: string | null;
  search?: string | null;
  page?: number | null;
  limit?: number | null;
};

type ProjectTaskAccess = {
  canManage: boolean;
  canAssigneeUpdate: boolean;
  canComment: boolean;
};

type ProjectMilestoneQuery = {
  projectId?: string | null;
  ownerId?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDateFilter?: string | null;
  search?: string | null;
  view?: string | null;
  page?: number | null;
  limit?: number | null;
};

type ProjectMilestoneAccess = {
  canManage: boolean;
  canOwnerUpdate: boolean;
  canView: boolean;
};

const taskStatusLabels: Record<ProjectTaskStatus, ProjectManagerTaskStatusLabel> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
};

const statusByLabel: Record<string, ProjectTaskStatus> = {
  todo: "todo",
  "to do": "todo",
  "in progress": "in_progress",
  in_progress: "in_progress",
  "in review": "in_review",
  in_review: "in_review",
  done: "done",
  blocked: "blocked",
};

const taskPriorityLabels: Record<ProjectTaskPriority, ProjectManagerTaskPriorityLabel> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityByLabel: Record<string, ProjectTaskPriority> = {
  low: "low",
  medium: "medium",
  high: "high",
};

const milestoneTypeLabels: Record<string, ProjectManagerMilestoneTypeLabel> = {
  internal: "Internal",
  client: "Client",
  release: "Release",
  delivery: "Delivery",
  review: "Review",
  support: "Support",
};

const milestoneStatusLabels: Record<
  ProjectMilestoneStatus,
  ProjectManagerMilestoneStatusLabel
> = {
  upcoming: "Upcoming",
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const milestoneStatusByLabel: Record<string, ProjectMilestoneStatus> = {
  upcoming: "upcoming",
  "on track": "on_track",
  on_track: "on_track",
  "at risk": "at_risk",
  at_risk: "at_risk",
  delayed: "delayed",
  completed: "completed",
  cancelled: "cancelled",
};

const milestonePriorityLabels: Record<
  ProjectMilestonePriority,
  ProjectManagerMilestonePriorityLabel
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function normalizeNullableText(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function normalizeTaskStatus(value?: string | null) {
  const normalized = normalizeNullableText(value)?.toLowerCase() ?? null;

  return normalized ? statusByLabel[normalized] ?? null : null;
}

function normalizeTaskPriority(value?: string | null) {
  const normalized = normalizeNullableText(value)?.toLowerCase() ?? null;

  return normalized ? priorityByLabel[normalized] ?? null : null;
}

function normalizeMilestoneStatusFilter(value?: string | null) {
  const normalized = normalizeNullableText(value)
    ?.toLowerCase()
    .replace(/\s+/g, "_") ?? null;

  return normalized ? milestoneStatusByLabel[normalized] ?? null : null;
}

function normalizeMilestonePriorityFilter(value?: string | null) {
  return normalizeTaskPriority(value) as ProjectMilestonePriority | null;
}

function normalizeMilestoneView(value?: string | null): ProjectMilestoneView {
  const normalized = normalizeNullableText(value)?.toLowerCase();

  return normalized === "timeline" ? "timeline" : "list";
}

function normalizeDueDateFilter(value?: string | null): ProjectTaskDueDateFilter {
  if (
    value === "today" ||
    value === "upcoming" ||
    value === "next-7-days" ||
    value === "this-month" ||
    value === "overdue"
  ) {
    return value;
  }

  return "all";
}

function normalizePage(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 1;
}

function normalizeLimit(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.round(value), 250)
    : 250;
}

function toIsoDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.includes("T") ? value.slice(0, 10) : value;
}

function toIsoDateTime(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function minutesToHours(value: number | string | null | undefined) {
  const minutes = toNumberOrNull(value);

  return minutes === null ? null : Math.round((minutes / 60) * 100) / 100;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildBoardPermissions(input: {
  role: AuthenticatedUser["role"];
  hasProjects: boolean;
  hasAssignees: boolean;
  access?: ProjectTaskAccess;
}): ProjectManagerTaskBoardPermissions {
  const canCreate =
    input.role === "project-manager" && input.hasProjects && input.hasAssignees;
  const canUpdate =
    input.access !== undefined
      ? Boolean(input.access.canManage || input.access.canAssigneeUpdate)
      : input.role === "project-manager" && input.hasProjects;
  const canReview = input.role === "project-manager" && input.hasProjects;
  const canComment = Boolean(input.access?.canComment ?? input.hasProjects);
  const note = !input.hasProjects
    ? "Create a project first before tasks can be added."
    : !input.hasAssignees
      ? "Add active project members before tasks can be assigned."
      : null;

  return {
    canCreate,
    canUpdate,
    canReview,
    canComment,
    note,
  };
}

function resolveTaskAccess(user: AuthenticatedUser, task: ProjectTaskRow): ProjectTaskAccess {
  const canManage = user.role === "project-manager";
  const canAssigneeUpdate = task.assigneeId === user.id;

  return {
    canManage,
    canAssigneeUpdate,
    canComment: canManage || canAssigneeUpdate,
  };
}

function mapProject(row: { id: string; projectCode: string; name: string }): ProjectManagerTaskProject {
  return {
    id: row.id,
    code: row.projectCode,
    name: row.name,
  };
}

function mapAssignee(row: {
  id: string;
  fullName: string;
  role: string;
}): ProjectManagerTaskAssignee {
  return {
    id: row.id,
    name: row.fullName,
    role: ROLE_DEFINITIONS[row.role as keyof typeof ROLE_DEFINITIONS]?.label ?? row.role,
  };
}

function mapChecklistItem(row: ProjectTaskChecklistRow): ProjectManagerTaskChecklistItem {
  return {
    id: row.id,
    title: row.title,
    completed: row.isCompleted,
  };
}

function mapComment(row: ProjectTaskCommentRow): ProjectManagerTaskComment {
  return {
    id: row.id,
    authorName: row.authorName ?? "Unknown user",
    message: row.comment,
    createdAt: toIsoDateTime(row.createdAt) ?? new Date(0).toISOString(),
  };
}

function readMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];

  return typeof value === "string" ? value : null;
}

function mapActivity(row: ProjectTaskActivityRow): ProjectManagerTaskActivity {
  const actorName = row.actorName ?? "System";
  const taskTitle = readMetadataString(row.metadata, "taskTitle") ?? "this task";
  const titleByType: Record<string, string> = {
    "task.created": "Task created",
    "task.status.changed": "Status changed",
    "task.assignee.changed": "Assignee changed",
    "task.priority.changed": "Priority changed",
    "task.due-date.changed": "Due date changed",
    "task.checklist.updated": "Checklist updated",
    "task.comment.added": "Comment added",
    "task.completed": "Task completed",
    "task.blocked": "Task blocked",
    "task.archived": "Task archived",
  };

  return {
    id: row.id,
    title: titleByType[row.activityType] ?? row.activityType,
    description:
      readMetadataString(row.metadata, "description") ??
      `${actorName} updated ${taskTitle}.`,
    createdAt: toIsoDateTime(row.createdAt) ?? new Date(0).toISOString(),
  };
}

function formatFileSize(value: number | string | null | undefined) {
  const bytes = toNumberOrNull(value);

  if (bytes === null) {
    return "--";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function mapAttachment(row: ProjectTaskAttachmentRow): ProjectManagerTaskFile {
  const name = row.fileName ?? row.documentName;

  return {
    id: row.id,
    name,
    type: row.documentType || name.split(".").pop()?.toUpperCase() || "FILE",
    size: formatFileSize(row.sizeBytes),
    uploadedAt: toIsoDateTime(row.uploadedAt) ?? new Date(0).toISOString(),
  };
}

function groupByTaskId<T extends { taskId: string }>(rows: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const items = grouped.get(row.taskId) ?? [];
    items.push(row);
    grouped.set(row.taskId, items);
  }

  return grouped;
}

function groupByMilestoneId<T extends { milestoneId: string }>(rows: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const items = grouped.get(row.milestoneId) ?? [];
    items.push(row);
    grouped.set(row.milestoneId, items);
  }

  return grouped;
}

function groupProjectMembersByProject(rows: readonly ProjectMemberRow[]) {
  const grouped = new Map<string, ProjectMemberRow[]>();

  for (const row of rows) {
    const items = grouped.get(row.projectId) ?? [];
    items.push(row);
    grouped.set(row.projectId, items);
  }

  return grouped;
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function mapMilestoneOwner(row: {
  id: string;
  fullName: string;
  role: string;
}): ProjectManagerMilestoneOwner {
  return {
    id: row.id,
    name: row.fullName,
    role: ROLE_DEFINITIONS[row.role as keyof typeof ROLE_DEFINITIONS]?.label ?? row.role,
    avatar: initialsFromName(row.fullName),
  };
}

function mapMilestoneProject(row: ProjectMilestoneRow): ProjectManagerMilestoneProject {
  return {
    id: row.projectId,
    code: row.projectCode,
    name: row.projectName,
  };
}

function mapLinkedMilestoneTask(
  row: ProjectMilestoneLinkedTaskRow,
): ProjectManagerMilestoneLinkedTask {
  return {
    id: row.taskCode,
    internalId: row.internalId,
    title: row.title,
    status: taskStatusLabels[row.status],
    priority: taskPriorityLabels[row.priority],
    dueDate: toIsoDate(row.dueDate),
    progress: clampPercent(Number(row.progressPercent)),
  };
}

function mapMilestoneDependency(
  row: ProjectMilestoneDependencyRow,
): ProjectManagerMilestoneDependency {
  return {
    id: row.id,
    dependencyType: row.dependencyType,
    milestone: {
      id: row.dependsOnMilestoneId,
      code: row.dependsOnCode,
      title: row.dependsOnTitle,
      status: milestoneStatusLabels[row.dependsOnStatus],
      dueDate: toIsoDate(row.dependsOnDueDate),
    },
    createdAt: toIsoDateTime(row.createdAt) ?? new Date(0).toISOString(),
  };
}

function mapMilestoneActivity(row: ProjectMilestoneActivityRow): ProjectManagerMilestoneActivity {
  const actorName = row.actorName ?? "System";
  const milestoneTitle = readMetadataString(row.metadata, "milestoneTitle") ?? "this milestone";
  const titleByType: Record<string, string> = {
    "milestone.created": "created milestone",
    "milestone.status.changed": "changed status",
    "milestone.progress.changed": "updated progress",
    "milestone.owner.changed": "changed owner",
    "milestone.due-date.changed": "changed due date",
    "milestone.dependency.added": "added dependency",
    "milestone.dependency.removed": "removed dependency",
    "milestone.task.linked": "linked task",
    "milestone.task.unlinked": "unlinked task",
    "milestone.completed": "completed milestone",
    "milestone.archived": "archived milestone",
  };

  return {
    id: row.id,
    actor: actorName,
    action:
      readMetadataString(row.metadata, "description") ??
      `${titleByType[row.activityType] ?? "updated"} for ${milestoneTitle}.`,
    at: toIsoDateTime(row.createdAt) ?? new Date(0).toISOString(),
  };
}

function mapMilestoneAttachment(
  row: ProjectMilestoneAttachmentRow,
): ProjectManagerMilestoneFile {
  return mapAttachment(row);
}

function calculateDurationDays(startDate: string | null, dueDate: string) {
  if (!startDate) {
    return null;
  }

  const startMs = Date.parse(`${startDate}T00:00:00.000Z`);
  const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`);

  if (Number.isNaN(startMs) || Number.isNaN(dueMs)) {
    return null;
  }

  return Math.max(1, Math.ceil((dueMs - startMs) / 86_400_000) + 1);
}

function resolveEffectiveMilestoneStatus(
  row: ProjectMilestoneRow,
  linkedTasks: readonly ProjectManagerMilestoneLinkedTask[],
  dependencies: readonly ProjectManagerMilestoneDependency[],
): ProjectMilestoneStatus {
  if (row.status === "cancelled") {
    return "cancelled";
  }

  if (row.completedAt || row.status === "completed") {
    return "completed";
  }

  const today = new Date().toISOString().slice(0, 10);
  const dueDate = toIsoDate(row.dueDate);

  if (dueDate < today) {
    return "delayed";
  }

  const daysUntilDue = Math.ceil(
    (Date.parse(`${dueDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) /
      86_400_000,
  );
  const progress = linkedTasks.length > 0
    ? clampPercent(
        (linkedTasks.filter((task) => task.status === "Done").length / linkedTasks.length) *
          100,
      )
    : clampPercent(Number(row.progressPercent));
  const hasBlockedOrOverdueHighPriorityTask = linkedTasks.some(
    (task) =>
      task.status === "Blocked" ||
      (task.priority === "High" && task.status !== "Done" && task.dueDate < today),
  );
  const hasDelayedDependency = dependencies.some(
    (dependency) => dependency.milestone.status === "Delayed",
  );

  if (
    (daysUntilDue <= 7 && progress < 70) ||
    hasBlockedOrOverdueHighPriorityTask ||
    hasDelayedDependency
  ) {
    return "at_risk";
  }

  const startDate = row.startDate ? toIsoDate(row.startDate) : null;

  if (startDate && startDate > today) {
    return "upcoming";
  }

  return "on_track";
}

function calculateMilestoneProgress(
  row: ProjectMilestoneRow,
  linkedTasks: readonly ProjectManagerMilestoneLinkedTask[],
) {
  if (linkedTasks.length === 0) {
    return clampPercent(Number(row.progressPercent));
  }

  return clampPercent(
    (linkedTasks.filter((task) => task.status === "Done").length / linkedTasks.length) *
      100,
  );
}

async function hydrateMilestoneRows(
  companyId: string,
  rows: readonly ProjectMilestoneRow[],
  executor?: DatabaseExecutor,
) {
  const milestoneIds = rows.map((row) => row.internalId);
  const projectIds = [...new Set(rows.map((row) => row.projectId))];
  const [members, linkedTasks, dependencies, activity, attachments] = await Promise.all([
    projectsRepository.listProjectMembersForProjects(companyId, projectIds, executor),
    projectsRepository.listTasksForMilestones(companyId, milestoneIds, executor),
    projectsRepository.listMilestoneDependencies(companyId, milestoneIds, executor),
    projectsRepository.listMilestoneActivityLogs(companyId, milestoneIds, executor),
    projectsRepository.listMilestoneAttachments(companyId, milestoneIds, executor),
  ]);
  const membersByProject = groupProjectMembersByProject(members);
  const tasksByMilestone = groupByMilestoneId(linkedTasks);
  const dependenciesByMilestone = groupByMilestoneId(dependencies);
  const activityByMilestone = groupByMilestoneId(activity);
  const attachmentsByMilestone = groupByMilestoneId(attachments);

  return rows.map((row) => {
    const tasks = (tasksByMilestone.get(row.internalId) ?? []).map(mapLinkedMilestoneTask);
    const dependencyItems = (dependenciesByMilestone.get(row.internalId) ?? []).map(
      mapMilestoneDependency,
    );
    const effectiveStatus = resolveEffectiveMilestoneStatus(row, tasks, dependencyItems);
    const progress = calculateMilestoneProgress(row, tasks);
    const owner = mapMilestoneOwner({
      id: row.ownerId,
      fullName: row.ownerName,
      role: row.ownerRole,
    });
    const team = [
      owner,
      ...(membersByProject.get(row.projectId) ?? []).map((member) =>
        mapMilestoneOwner({
          id: member.userId,
          fullName: member.fullName,
          role: member.role,
        }),
      ),
    ].filter(
      (member, index, list) => list.findIndex((item) => item.id === member.id) === index,
    );
    const startDate = row.startDate ? toIsoDate(row.startDate) : null;
    const dueDate = toIsoDate(row.dueDate);
    const targetCompletion = row.targetCompletionDate
      ? toIsoDate(row.targetCompletionDate)
      : null;

    return {
      id: row.milestoneCode,
      internalId: row.internalId,
      title: row.title,
      project: mapMilestoneProject(row),
      owner,
      status: milestoneStatusLabels[effectiveStatus],
      milestoneType: milestoneTypeLabels[row.milestoneType],
      phase: row.phase,
      priority: milestonePriorityLabels[row.priority],
      progress,
      dueDate,
      startDate,
      targetCompletion,
      completedAt: toIsoDateTime(row.completedAt),
      dependencies: dependencyItems.length,
      team,
      description: row.description,
      createdBy: row.createdByName ?? "System",
      durationDays: calculateDurationDays(startDate, dueDate),
      baselineProgress: toNumberOrNull(row.baselineProgress),
      criteria: row.completionCriteria,
      tags: [row.phase, milestoneTypeLabels[row.milestoneType]].filter(Boolean),
      linkedTasks: tasks,
      dependencyItems,
      activity: (activityByMilestone.get(row.internalId) ?? []).map(mapMilestoneActivity),
      files: (attachmentsByMilestone.get(row.internalId) ?? []).map(mapMilestoneAttachment),
      lastUpdated: toIsoDateTime(row.updatedAt) ?? new Date(0).toISOString(),
    } satisfies ProjectManagerMilestoneRecord;
  });
}

async function hydrateTaskRows(
  companyId: string,
  rows: readonly ProjectTaskRow[],
  executor?: DatabaseExecutor,
) {
  const taskIds = rows.map((row) => row.internalId);
  const [checklist, comments, activity, attachments] = await Promise.all([
    projectsRepository.listChecklistItems(companyId, taskIds, executor),
    projectsRepository.listComments(companyId, taskIds, executor),
    projectsRepository.listActivityLogs(companyId, taskIds, executor),
    projectsRepository.listAttachments(companyId, taskIds, executor),
  ]);
  const checklistByTask = groupByTaskId(checklist);
  const commentsByTask = groupByTaskId(comments);
  const activityByTask = groupByTaskId(activity);
  const attachmentsByTask = groupByTaskId(attachments);

  return rows.map((row) => ({
    id: row.taskCode,
    title: row.title,
    project: {
      id: row.projectId,
      code: row.projectCode,
      name: row.projectName,
    },
    assignee: {
      id: row.assigneeId,
      name: row.assigneeName,
      role:
        ROLE_DEFINITIONS[row.assigneeRole as keyof typeof ROLE_DEFINITIONS]?.label ??
        row.assigneeRole,
    },
    reviewerId: row.status === "in_review" ? row.projectManagerId : null,
    priority: taskPriorityLabels[row.priority],
    status: taskStatusLabels[row.status],
    dueDate: toIsoDate(row.dueDate),
    description: row.description,
    checklist: (checklistByTask.get(row.internalId) ?? []).map(mapChecklistItem),
    comments: (commentsByTask.get(row.internalId) ?? []).map(mapComment),
    activity: (activityByTask.get(row.internalId) ?? []).map(mapActivity),
    files: (attachmentsByTask.get(row.internalId) ?? []).map(mapAttachment),
    subtasks: [],
    estimatedHours: minutesToHours(row.estimatedMinutes),
    spentHours: minutesToHours(row.spentMinutes),
    progress: clampPercent(Number(row.progressPercent)),
    lastUpdated: toIsoDateTime(row.updatedAt) ?? new Date(0).toISOString(),
  })) satisfies ProjectManagerTaskRecord[];
}

function buildSummary(tasks: readonly ProjectManagerTaskRecord[]): ProjectManagerTaskSummary {
  const today = new Date().toISOString().slice(0, 10);

  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "To Do").length,
    inProgress: tasks.filter((task) => task.status === "In Progress").length,
    inReview: tasks.filter((task) => task.status === "In Review").length,
    done: tasks.filter((task) => task.status === "Done").length,
    overdue: tasks.filter((task) => task.status !== "Done" && task.dueDate < today).length,
    highPriority: tasks.filter((task) => task.priority === "High").length,
  };
}

function buildMilestonePermissions(input: {
  role: AuthenticatedUser["role"];
  hasProjects: boolean;
  hasOwners: boolean;
  access?: ProjectMilestoneAccess;
}): ProjectManagerMilestonePermissions {
  const canCreate =
    input.role === "project-manager" && input.hasProjects && input.hasOwners;
  const canManage = input.access !== undefined
    ? input.access.canManage
    : input.role === "project-manager" && input.hasProjects;
  const canOwnerUpdate = Boolean(input.access?.canOwnerUpdate);
  const note = !input.hasProjects
    ? "Create a project before adding milestones."
    : !input.hasOwners
      ? "Add active project members before assigning milestones."
      : null;

  return {
    canCreate,
    canUpdate: canManage || canOwnerUpdate,
    canComplete: canManage,
    canArchive: canManage,
    canLinkTasks: canManage,
    canManageDependencies: canManage,
    note,
  };
}

function resolveMilestoneAccess(
  user: AuthenticatedUser,
  milestone: ProjectMilestoneRow,
): ProjectMilestoneAccess {
  const canManage =
    user.role === "project-manager" && milestone.projectManagerId === user.id;
  const canOwnerUpdate = milestone.ownerId === user.id;

  return {
    canManage,
    canOwnerUpdate,
    canView: canManage || canOwnerUpdate,
  };
}

function buildMilestoneSummary(
  milestones: readonly ProjectManagerMilestoneRecord[],
): ProjectManagerMilestoneSummary {
  const completed = milestones.filter((milestone) => milestone.status === "Completed").length;
  const total = milestones.length;

  return {
    total,
    upcoming: milestones.filter((milestone) => milestone.status === "Upcoming").length,
    completed,
    delayed: milestones.filter((milestone) => milestone.status === "Delayed").length,
    atRisk: milestones.filter((milestone) => milestone.status === "At Risk").length,
    onTrack: milestones.filter((milestone) => milestone.status === "On Track").length,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function normalizeMilestoneQuery(query: ProjectMilestoneQuery) {
  return {
    projectId: normalizeNullableText(query.projectId),
    ownerId: normalizeNullableText(query.ownerId),
    status: normalizeMilestoneStatusFilter(query.status),
    priority: normalizeMilestonePriorityFilter(query.priority),
    dueDateFilter: normalizeDueDateFilter(query.dueDateFilter),
    search: normalizeNullableText(query.search) ?? "",
    view: normalizeMilestoneView(query.view),
    page: normalizePage(query.page),
    limit: normalizeLimit(query.limit),
  };
}

function normalizeTaskQuery(query: ProjectTaskQuery) {
  return {
    projectId: normalizeNullableText(query.projectId),
    assigneeId: normalizeNullableText(query.assigneeId),
    status: normalizeTaskStatus(query.status),
    priority: normalizeTaskPriority(query.priority),
    dueDateFilter: normalizeDueDateFilter(query.dueDateFilter),
    search: normalizeNullableText(query.search) ?? "",
    page: normalizePage(query.page),
    limit: normalizeLimit(query.limit),
  };
}

function buildActivityDescription(
  actorName: string,
  taskTitle: string,
  message: string,
) {
  return `${actorName} ${message} for ${taskTitle}.`;
}

async function createActivity(
  input: {
    companyId: string;
    taskId: string;
    actor: AuthenticatedUser;
    taskTitle: string;
    activityType: string;
    oldValue?: string | null;
    newValue?: string | null;
    description: string;
  },
  executor?: DatabaseExecutor,
) {
  await projectsRepository.createActivityLog(
    {
      id: randomUUID(),
      companyId: input.companyId,
      taskId: input.taskId,
      actorId: input.actor.id,
      activityType: input.activityType,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      metadata: {
        taskTitle: input.taskTitle,
        description: input.description,
      },
    },
    executor,
  );
}

async function createMilestoneActivity(
  input: {
    companyId: string;
    milestoneId: string;
    actor: AuthenticatedUser;
    milestoneTitle: string;
    activityType: string;
    oldValue?: string | null;
    newValue?: string | null;
    description: string;
  },
  executor?: DatabaseExecutor,
) {
  await projectsRepository.createMilestoneActivityLog(
    {
      id: randomUUID(),
      companyId: input.companyId,
      milestoneId: input.milestoneId,
      actorId: input.actor.id,
      activityType: input.activityType,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      metadata: {
        milestoneTitle: input.milestoneTitle,
        description: input.description,
      },
    },
    executor,
  );
}

function buildMilestoneActivityDescription(
  actorName: string,
  milestoneTitle: string,
  message: string,
) {
  return `${actorName} ${message} for ${milestoneTitle}.`;
}

function getChangedFields(
  existing: ProjectTaskRow,
  input: UpdateProjectTaskRequest,
) {
  const changes: Array<{
    field: keyof UpdateProjectTaskRequest;
    activityType: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  const pushChange = (
    field: keyof UpdateProjectTaskRequest,
    activityType: string,
    oldValue: string | null,
    newValue: string | null,
  ) => {
    if (oldValue !== newValue) {
      changes.push({ field, activityType, oldValue, newValue });
    }
  };

  if (input.status !== undefined) {
    pushChange(
      "status",
      "task.status.changed",
      taskStatusLabels[existing.status],
      taskStatusLabels[input.status],
    );
  }

  if (input.priority !== undefined) {
    pushChange(
      "priority",
      "task.priority.changed",
      taskPriorityLabels[existing.priority],
      taskPriorityLabels[input.priority],
    );
  }

  if (input.assigneeId !== undefined) {
    pushChange("assigneeId", "task.assignee.changed", existing.assigneeId, input.assigneeId);
  }

  if (input.dueDate !== undefined) {
    pushChange("dueDate", "task.due-date.changed", toIsoDate(existing.dueDate), input.dueDate);
  }

  return changes;
}

function getMilestoneChangedFields(
  existing: ProjectMilestoneRow,
  input: UpdateProjectMilestoneRequest,
) {
  const changes: Array<{
    field: keyof UpdateProjectMilestoneRequest;
    activityType: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];
  const pushChange = (
    field: keyof UpdateProjectMilestoneRequest,
    activityType: string,
    oldValue: string | null,
    newValue: string | null,
  ) => {
    if (oldValue !== newValue) {
      changes.push({ field, activityType, oldValue, newValue });
    }
  };

  if (input.status !== undefined) {
    pushChange(
      "status",
      "milestone.status.changed",
      milestoneStatusLabels[existing.status],
      milestoneStatusLabels[input.status],
    );
  }

  if (input.progressPercent !== undefined) {
    pushChange(
      "progressPercent",
      "milestone.progress.changed",
      String(existing.progressPercent),
      String(input.progressPercent),
    );
  }

  if (input.ownerId !== undefined) {
    pushChange("ownerId", "milestone.owner.changed", existing.ownerId, input.ownerId);
  }

  if (input.dueDate !== undefined) {
    pushChange("dueDate", "milestone.due-date.changed", toIsoDate(existing.dueDate), input.dueDate);
  }

  return changes;
}

async function findHydratedTask(
  companyId: string,
  userId: string,
  taskId: string,
  executor?: DatabaseExecutor,
) {
  const row = await projectsRepository.findTaskById(
    companyId,
    userId,
    taskId,
    executor,
  );

  if (!row) {
    return null;
  }

  const [task] = await hydrateTaskRows(companyId, [row], executor);

  return {
    row,
    task,
  };
}

async function findHydratedMilestone(
  companyId: string,
  userId: string,
  milestoneId: string,
  executor?: DatabaseExecutor,
) {
  const row = await projectsRepository.findMilestoneById(
    companyId,
    userId,
    milestoneId,
    executor,
  );

  if (!row) {
    return null;
  }

  const [milestone] = await hydrateMilestoneRows(companyId, [row], executor);

  return {
    row,
    milestone,
  };
}

function uniqueUserIds(ids: Array<string | null | undefined>, excludedUserId: string) {
  return [...new Set(ids.filter((id): id is string => Boolean(id && id !== excludedUserId)))];
}

function notifyTaskUsers(
  companyId: string,
  userIds: readonly string[],
  input: Parameters<typeof notificationsService.notifyUsers>[2],
) {
  if (userIds.length === 0) {
    return;
  }

  void notificationsService.notifyUsers(companyId, userIds, input);
}

async function syncTaskProgressFromChecklist(
  companyId: string,
  task: ProjectTaskRow,
  executor?: DatabaseExecutor,
) {
  if (task.status === "done") {
    return;
  }

  const checklist = await projectsRepository.listChecklistItems(
    companyId,
    [task.internalId],
    executor,
  );

  if (checklist.length === 0) {
    return;
  }

  const completed = checklist.filter((item) => item.isCompleted).length;
  const progressPercent = clampPercent((completed / checklist.length) * 100);

  await projectsRepository.updateTask(
    {
      companyId,
      taskId: task.internalId,
      progressPercent,
    },
    executor,
  );
}

export const projectsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<ManagerServiceResult<ManagerWorkspaceResponse>> {
    const contextResult = await ensureManagerContext(user);

    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data;
    const { currentDate, items: attendance } = await buildAttendanceEntries(
      context.company.id,
      context.teamMembers,
    );
    const { items: leaveRequests, approvalQueue } = await buildLeaveEntries(
      context.company.id,
      context.teamMembers,
      context.viewer.role,
    );

    return ok({
      company: {
        id: context.company.id,
        name: context.company.name,
        code: context.company.code,
        industry: context.company.industry,
        status: context.company.status,
      },
      viewer: toViewerProfile(context.viewer),
      scope: context.scope,
      summary: {
        totalTeamMembers: context.teamMembers.length,
        activeTeamMembers: context.teamMembers.filter(
          (member) => member.status === "active",
        ).length,
        attendanceRecordsToday: attendance.filter(
          (entry) => entry.attendanceDate === currentDate,
        ).length,
        openAttendanceSessions: attendance.filter(
          (entry) => entry.status === "checked-in",
        ).length,
        totalLeaveRequests: leaveRequests.length,
        pendingApprovals: approvalQueue.length,
      },
      teamMembers: context.teamMembers,
      attendance,
      leaveRequests,
      approvalQueue,
    });
  },

  async getTeamMembers(
    user: AuthenticatedUser,
  ): Promise<ManagerServiceResult<ManagerTeamResponse>> {
    const contextResult = await ensureManagerContext(user);

    if (!contextResult.ok) {
      return contextResult;
    }

    return ok({
      scope: contextResult.data.scope,
      items: contextResult.data.teamMembers,
    });
  },

  async getTeamAttendance(
    user: AuthenticatedUser,
  ): Promise<ManagerServiceResult<ManagerAttendanceResponse>> {
    const contextResult = await ensureManagerContext(user);

    if (!contextResult.ok) {
      return contextResult;
    }

    const attendance = await buildAttendanceEntries(
      contextResult.data.company.id,
      contextResult.data.teamMembers,
    );

    return ok({
      scope: contextResult.data.scope,
      items: attendance.items,
    });
  },

  async getTeamLeave(
    user: AuthenticatedUser,
  ): Promise<ManagerServiceResult<ManagerLeaveResponse>> {
    const contextResult = await ensureManagerContext(user);

    if (!contextResult.ok) {
      return contextResult;
    }

    const leave = await buildLeaveEntries(
      contextResult.data.company.id,
      contextResult.data.teamMembers,
      contextResult.data.viewer.role,
    );

    return ok({
      scope: contextResult.data.scope,
      items: leave.items,
      approvalQueue: leave.approvalQueue,
    });
  },

  async listMilestones(
    user: AuthenticatedUser,
    query: ProjectMilestoneQuery = {},
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const filters = normalizeMilestoneQuery(query);
    let [projectRows, ownerRows] = await Promise.all([
      projectsRepository.listAccessibleProjects(user.companyId, user.id),
      projectsRepository.listAssigneesForAccessibleProjects(user.companyId, user.id),
    ]);

    if (
      user.role === "project-manager" &&
      (projectRows.length === 0 || ownerRows.length === 0)
    ) {
      await withTransaction(async (client) => {
        await projectsRepository.ensureDefaultProjectWorkspace(
          {
            companyId: user.companyId!,
            projectId: randomUUID(),
            managerId: user.id,
          },
          client,
        );
      });

      [projectRows, ownerRows] = await Promise.all([
        projectsRepository.listAccessibleProjects(user.companyId, user.id),
        projectsRepository.listAssigneesForAccessibleProjects(user.companyId, user.id),
      ]);
    }

    const milestoneResult = await projectsRepository.listMilestones({
      companyId: user.companyId,
      userId: user.id,
      projectId: filters.projectId,
      ownerId: filters.ownerId,
      status: filters.status,
      priority: filters.priority,
      dueDateFilter: filters.dueDateFilter,
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    });
    const milestones = await hydrateMilestoneRows(
      user.companyId,
      milestoneResult.milestones,
    );
    const allMilestoneResult = await projectsRepository.listMilestones({
      companyId: user.companyId,
      userId: user.id,
      page: 1,
      limit: null,
    });
    const allMilestones = await hydrateMilestoneRows(
      user.companyId,
      allMilestoneResult.milestones,
    );
    const permissions = buildMilestonePermissions({
      role: user.role,
      hasProjects: projectRows.length > 0,
      hasOwners: ownerRows.length > 0,
    });

    return ok({
      viewer: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
      },
      dataSource: "api",
      permissions,
      summary: buildMilestoneSummary(allMilestones),
      projects: projectRows.map(mapProject),
      owners: ownerRows.map((owner) =>
        mapMilestoneOwner({
          id: owner.id,
          fullName: owner.fullName,
          role: owner.role,
        }),
      ),
      milestones,
      filters,
      rightPanel: {
        upcomingDeadlines: allMilestones
          .filter(
            (milestone) =>
              milestone.status !== "Completed" &&
              milestone.status !== "Cancelled" &&
              milestone.dueDate >= new Date().toISOString().slice(0, 10),
          )
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
          .slice(0, 6),
        atRiskMilestones: allMilestones
          .filter(
            (milestone) =>
              milestone.status === "At Risk" || milestone.status === "Delayed",
          )
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
          .slice(0, 6),
      },
      pagination: milestoneResult.pagination,
    });
  },

  async getMilestoneDetails(
    user: AuthenticatedUser,
    milestoneId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneDetailsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const hydrated = await findHydratedMilestone(user.companyId, user.id, milestoneId);

    if (!hydrated) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, hydrated.row);

    return ok({
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access,
      }),
    });
  },

  async createMilestone(
    user: AuthenticatedUser,
    input: CreateProjectMilestoneRequest,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const project = await projectsRepository.findAccessibleProjectById(
      user.companyId,
      user.id,
      input.projectId,
    );

    if (!project) {
      return fail(404, "Project not found in your project scope.");
    }

    if (user.role !== "project-manager" || !project.isManager) {
      return fail(403, "Only the assigned Project Manager can create milestones for this project.");
    }

    const ownerIsProjectMember =
      input.ownerId === project.projectManagerId ||
      (await projectsRepository.isActiveProjectMember(
        user.companyId,
        project.id,
        input.ownerId,
      ));

    if (!ownerIsProjectMember) {
      return fail(409, "Milestone owner must be the project manager or an active project member.");
    }

    const linkedTaskRows: ProjectTaskRow[] = [];

    for (const taskId of input.linkedTaskIds) {
      const task = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

      if (!task || task.projectId !== project.id) {
        return fail(409, "Linked tasks must belong to the selected project.");
      }

      linkedTaskRows.push(task);
    }

    const dependencyRows: ProjectMilestoneRow[] = [];

    for (const dependencyId of input.dependencyIds) {
      const dependency = await projectsRepository.findMilestoneById(
        user.companyId,
        user.id,
        dependencyId,
      );

      if (!dependency) {
        return fail(409, "Dependency milestone must be in your project scope.");
      }

      dependencyRows.push(dependency);
    }

    const today = new Date().toISOString().slice(0, 10);
    const initialStatus: ProjectMilestoneStatus =
      input.dueDate < today
        ? "delayed"
        : input.startDate && input.startDate > today
          ? "upcoming"
          : input.dueDate <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) &&
              input.progressPercent < 70
            ? "at_risk"
            : "on_track";
    const createdMilestoneId = await withTransaction(async (client) => {
      const milestoneId = randomUUID();
      const milestoneCode = await projectsRepository.getNextMilestoneCode(
        user.companyId!,
        client,
      );

      await projectsRepository.createMilestone(
        {
          id: milestoneId,
          companyId: user.companyId!,
          projectId: project.id,
          milestoneCode,
          title: input.title,
          description: input.description,
          milestoneType: input.milestoneType,
          phase: input.phase,
          status: initialStatus,
          priority: input.priority,
          ownerId: input.ownerId,
          startDate: input.startDate,
          dueDate: input.dueDate,
          targetCompletionDate: input.targetCompletionDate,
          progressPercent: input.progressPercent,
          baselineProgress: input.baselineProgress,
          completionCriteria: input.completionCriteria,
          createdBy: user.id,
        },
        client,
      );

      for (const task of linkedTaskRows) {
        await projectsRepository.linkTaskToMilestone(
          user.companyId!,
          project.id,
          milestoneId,
          task.internalId,
          client,
        );
      }

      for (const dependency of dependencyRows) {
        if (dependency.internalId === milestoneId) {
          continue;
        }

        await projectsRepository.addMilestoneDependency(
          {
            id: randomUUID(),
            companyId: user.companyId!,
            milestoneId,
            dependsOnMilestoneId: dependency.internalId,
            dependencyType: "blocks",
            createdBy: user.id,
          },
          client,
        );
      }

      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId,
          actor: user,
          milestoneTitle: input.title,
          activityType: "milestone.created",
          description: buildMilestoneActivityDescription(
            user.fullName,
            input.title,
            "created milestone",
          ),
        },
        client,
      );

      await projectsRepository.refreshProjectMilestonesFromTasks(
        user.companyId!,
        project.id,
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        project.id,
        client,
      );

      return milestoneCode;
    });

    const hydrated = await findHydratedMilestone(
      user.companyId,
      user.id,
      createdMilestoneId,
    );

    if (!hydrated) {
      return fail(404, "Created milestone could not be loaded.");
    }

    notifyTaskUsers(
      user.companyId,
      uniqueUserIds([hydrated.row.ownerId], user.id),
      {
        type: "project.milestone.assigned",
        title: "Milestone assigned",
        message: `${user.fullName} assigned ${hydrated.milestone.title} to you.`,
        entityType: "project_milestone",
        entityId: hydrated.row.internalId,
      },
    );

    void auditService.recordAction(user, {
      action: "project_milestone.created",
      entityType: "project_milestone",
      entityId: hydrated.row.internalId,
      metadata: {
        milestoneCode: hydrated.row.milestoneCode,
        projectId: hydrated.row.projectId,
        ownerId: hydrated.row.ownerId,
      },
    });

    return ok({
      message: "Milestone created successfully.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async updateMilestone(
    user: AuthenticatedUser,
    milestoneId: string,
    input: UpdateProjectMilestoneRequest,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage && !access.canOwnerUpdate) {
      return fail(403, "You do not have access to update this milestone.");
    }

    if (!access.canManage) {
      const allowedOwnerFields = new Set<keyof UpdateProjectMilestoneRequest>([
        "progressPercent",
      ]);
      const requestedFields = Object.keys(input) as Array<keyof UpdateProjectMilestoneRequest>;

      if (requestedFields.some((field) => !allowedOwnerFields.has(field))) {
        return fail(403, "Milestone owners can only update milestone progress.");
      }
    }

    if (input.ownerId !== undefined) {
      const ownerIsProjectMember =
        input.ownerId === existing.projectManagerId ||
        (await projectsRepository.isActiveProjectMember(
          user.companyId,
          existing.projectId,
          input.ownerId,
        ));

      if (!ownerIsProjectMember) {
        return fail(409, "Milestone owner must be the project manager or an active project member.");
      }
    }

    if (
      (input.startDate ?? (existing.startDate ? toIsoDate(existing.startDate) : null)) &&
      (input.dueDate ?? toIsoDate(existing.dueDate)) <
        (input.startDate ?? (existing.startDate ? toIsoDate(existing.startDate) : ""))
    ) {
      return fail(409, "Due date cannot be before start date.");
    }

    const changedFields = getMilestoneChangedFields(existing, input);
    const nextStatus = input.status ?? existing.status;
    const completedAt =
      input.status === "completed"
        ? existing.completedAt
          ? toIsoDateTime(existing.completedAt)
          : new Date().toISOString()
        : input.status && existing.status === "completed"
          ? null
          : undefined;
    const progressPercent =
      input.progressPercent !== undefined
        ? input.progressPercent
        : nextStatus === "completed"
          ? 100
          : undefined;

    await withTransaction(async (client) => {
      await projectsRepository.updateMilestone(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          ...input,
          progressPercent,
          completedAt,
        },
        client,
      );

      for (const change of changedFields) {
        await createMilestoneActivity(
          {
            companyId: user.companyId!,
            milestoneId: existing.internalId,
            actor: user,
            milestoneTitle: existing.title,
            activityType: change.activityType,
            oldValue: change.oldValue,
            newValue: change.newValue,
            description: buildMilestoneActivityDescription(
              user.fullName,
              existing.title,
              `changed ${String(change.field)}`,
            ),
          },
          client,
        );
      }

      if (existing.status !== "completed" && nextStatus === "completed") {
        await createMilestoneActivity(
          {
            companyId: user.companyId!,
            milestoneId: existing.internalId,
            actor: user,
            milestoneTitle: existing.title,
            activityType: "milestone.completed",
            description: buildMilestoneActivityDescription(
              user.fullName,
              existing.title,
              "completed milestone",
            ),
          },
          client,
        );
      }

      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );
    });

    const hydrated = await findHydratedMilestone(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated milestone could not be loaded.");
    }

    if (input.ownerId && input.ownerId !== existing.ownerId) {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([input.ownerId], user.id),
        {
          type: "project.milestone.assigned",
          title: "Milestone assigned",
          message: `${user.fullName} assigned ${hydrated.milestone.title} to you.`,
          entityType: "project_milestone",
          entityId: existing.internalId,
        },
      );
    }

    if (input.dueDate && input.dueDate !== toIsoDate(existing.dueDate)) {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([hydrated.row.ownerId], user.id),
        {
          type: "project.milestone.due-date-changed",
          title: "Milestone due date changed",
          message: `${hydrated.milestone.title} is now due on ${hydrated.milestone.dueDate}.`,
          entityType: "project_milestone",
          entityId: existing.internalId,
        },
      );
    }

    if (hydrated.milestone.status === "At Risk" || hydrated.milestone.status === "Delayed") {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([hydrated.row.projectManagerId], user.id),
        {
          type:
            hydrated.milestone.status === "Delayed"
              ? "project.milestone.delayed"
              : "project.milestone.at-risk",
          title:
            hydrated.milestone.status === "Delayed"
              ? "Milestone delayed"
              : "Milestone at risk",
          message: `${hydrated.milestone.title} is ${hydrated.milestone.status.toLowerCase()}.`,
          entityType: "project_milestone",
          entityId: existing.internalId,
        },
      );
    }

    return ok({
      message: "Milestone updated successfully.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async completeMilestone(
    user: AuthenticatedUser,
    milestoneId: string,
    _input: CompleteProjectMilestoneRequest = {},
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const hydratedBefore = await findHydratedMilestone(user.companyId, user.id, milestoneId);

    if (!hydratedBefore) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, hydratedBefore.row);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can complete this milestone.");
    }

    const incompleteTasks = hydratedBefore.milestone.linkedTasks.filter(
      (task) => task.status !== "Done",
    );

    if (incompleteTasks.length > 0) {
      return fail(409, "All linked tasks must be done before completing this milestone.");
    }

    await withTransaction(async (client) => {
      await projectsRepository.updateMilestone(
        {
          companyId: user.companyId!,
          milestoneId: hydratedBefore.row.internalId,
          status: "completed",
          completedAt: new Date().toISOString(),
          progressPercent: 100,
        },
        client,
      );

      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: hydratedBefore.row.internalId,
          actor: user,
          milestoneTitle: hydratedBefore.row.title,
          activityType: "milestone.completed",
          description: buildMilestoneActivityDescription(
            user.fullName,
            hydratedBefore.row.title,
            "completed milestone",
          ),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        hydratedBefore.row.projectId,
        client,
      );
    });

    const hydrated = await findHydratedMilestone(
      user.companyId,
      user.id,
      hydratedBefore.row.internalId,
    );

    if (!hydrated) {
      return fail(404, "Completed milestone could not be loaded.");
    }

    const members = await projectsRepository.listProjectMembersForProjects(
      user.companyId,
      [hydrated.row.projectId],
    );

    notifyTaskUsers(
      user.companyId,
      uniqueUserIds(
        [hydrated.row.ownerId, hydrated.row.projectManagerId, ...members.map((member) => member.userId)],
        user.id,
      ),
      {
        type: "project.milestone.completed",
        title: "Milestone completed",
        message: `${hydrated.milestone.title} has been completed.`,
        entityType: "project_milestone",
        entityId: hydrated.row.internalId,
      },
    );

    return ok({
      message: "Milestone completed successfully.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async archiveMilestone(
    user: AuthenticatedUser,
    milestoneId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can archive this milestone.");
    }

    const [milestoneBeforeArchive] = await hydrateMilestoneRows(user.companyId, [existing]);

    await withTransaction(async (client) => {
      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          actor: user,
          milestoneTitle: existing.title,
          activityType: "milestone.archived",
          description: buildMilestoneActivityDescription(
            user.fullName,
            existing.title,
            "archived milestone",
          ),
        },
        client,
      );
      await projectsRepository.archiveMilestone(user.companyId!, existing.internalId, client);
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );
    });

    return ok({
      message: "Milestone archived successfully.",
      milestone: milestoneBeforeArchive,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access,
      }),
    });
  },

  async listMilestoneDependencies(
    user: AuthenticatedUser,
    milestoneId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneDependenciesResponse>> {
    const detailResult = await this.getMilestoneDetails(user, milestoneId);

    if (!detailResult.ok) {
      return detailResult;
    }

    return ok({
      dependencies: detailResult.data.milestone.dependencyItems,
    });
  },

  async addMilestoneDependency(
    user: AuthenticatedUser,
    milestoneId: string,
    input: CreateProjectMilestoneDependencyRequest,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can add milestone dependencies.");
    }

    const dependency = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      input.dependsOnMilestoneId,
    );

    if (!dependency) {
      return fail(404, "Dependency milestone not found.");
    }

    if (dependency.internalId === existing.internalId) {
      return fail(409, "A milestone cannot depend on itself.");
    }

    const duplicate = await projectsRepository.dependencyExists(
      user.companyId,
      existing.internalId,
      dependency.internalId,
    );

    if (duplicate) {
      return fail(409, "This milestone dependency already exists.");
    }

    await withTransaction(async (client) => {
      await projectsRepository.addMilestoneDependency(
        {
          id: randomUUID(),
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          dependsOnMilestoneId: dependency.internalId,
          dependencyType: input.dependencyType,
          createdBy: user.id,
        },
        client,
      );

      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          actor: user,
          milestoneTitle: existing.title,
          activityType: "milestone.dependency.added",
          description: buildMilestoneActivityDescription(
            user.fullName,
            existing.title,
            "added dependency",
          ),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );
    });

    const hydrated = await findHydratedMilestone(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated milestone could not be loaded.");
    }

    return ok({
      message: "Dependency added.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async removeMilestoneDependency(
    user: AuthenticatedUser,
    milestoneId: string,
    dependencyId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can remove milestone dependencies.");
    }

    const removed = await withTransaction(async (client) => {
      const result = await projectsRepository.removeMilestoneDependency(
        user.companyId!,
        existing.internalId,
        dependencyId,
        client,
      );

      if (!result) {
        return false;
      }

      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          actor: user,
          milestoneTitle: existing.title,
          activityType: "milestone.dependency.removed",
          description: buildMilestoneActivityDescription(
            user.fullName,
            existing.title,
            "removed dependency",
          ),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );

      return true;
    });

    if (!removed) {
      return fail(404, "Dependency not found.");
    }

    const hydrated = await findHydratedMilestone(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated milestone could not be loaded.");
    }

    return ok({
      message: "Dependency removed.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async listMilestoneTasks(
    user: AuthenticatedUser,
    milestoneId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneTasksResponse>> {
    const detailResult = await this.getMilestoneDetails(user, milestoneId);

    if (!detailResult.ok) {
      return detailResult;
    }

    return ok({
      tasks: detailResult.data.milestone.linkedTasks,
    });
  },

  async linkTaskToMilestone(
    user: AuthenticatedUser,
    milestoneId: string,
    taskId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can link milestone tasks.");
    }

    const task = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!task || task.projectId !== existing.projectId) {
      return fail(409, "Linked task must belong to the milestone project.");
    }

    await withTransaction(async (client) => {
      await projectsRepository.linkTaskToMilestone(
        user.companyId!,
        existing.projectId,
        existing.internalId,
        task.internalId,
        client,
      );
      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          actor: user,
          milestoneTitle: existing.title,
          activityType: "milestone.task.linked",
          description: buildMilestoneActivityDescription(
            user.fullName,
            existing.title,
            "linked task",
          ),
        },
        client,
      );
      await projectsRepository.refreshProjectMilestonesFromTasks(
        user.companyId!,
        existing.projectId,
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );
    });

    const hydrated = await findHydratedMilestone(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated milestone could not be loaded.");
    }

    return ok({
      message: "Task linked.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async unlinkTaskFromMilestone(
    user: AuthenticatedUser,
    milestoneId: string,
    taskId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findMilestoneById(
      user.companyId,
      user.id,
      milestoneId,
    );

    if (!existing) {
      return fail(404, "Milestone not found.");
    }

    const access = resolveMilestoneAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the assigned Project Manager can unlink milestone tasks.");
    }

    const removed = await withTransaction(async (client) => {
      const linkedTaskId = await projectsRepository.unlinkTaskFromMilestone(
        user.companyId!,
        existing.projectId,
        existing.internalId,
        taskId,
        client,
      );

      if (!linkedTaskId) {
        return false;
      }

      await createMilestoneActivity(
        {
          companyId: user.companyId!,
          milestoneId: existing.internalId,
          actor: user,
          milestoneTitle: existing.title,
          activityType: "milestone.task.unlinked",
          description: buildMilestoneActivityDescription(
            user.fullName,
            existing.title,
            "unlinked task",
          ),
        },
        client,
      );
      await projectsRepository.refreshProjectMilestonesFromTasks(
        user.companyId!,
        existing.projectId,
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );

      return true;
    });

    if (!removed) {
      return fail(404, "Linked task not found.");
    }

    const hydrated = await findHydratedMilestone(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated milestone could not be loaded.");
    }

    return ok({
      message: "Task unlinked.",
      milestone: hydrated.milestone,
      permissions: buildMilestonePermissions({
        role: user.role,
        hasProjects: true,
        hasOwners: true,
        access: resolveMilestoneAccess(user, hydrated.row),
      }),
    });
  },

  async listMilestoneActivity(
    user: AuthenticatedUser,
    milestoneId: string,
  ): Promise<ManagerServiceResult<ProjectManagerMilestoneActivityResponse>> {
    const detailResult = await this.getMilestoneDetails(user, milestoneId);

    if (!detailResult.ok) {
      return detailResult;
    }

    return ok({
      activity: detailResult.data.milestone.activity,
    });
  },

  async listTasks(
    user: AuthenticatedUser,
    query: ProjectTaskQuery = {},
  ): Promise<ManagerServiceResult<ProjectManagerTaskBoardResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await companiesService.getCompanyView(user.companyId);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const filters = normalizeTaskQuery(query);
    let [projectRows, assigneeRows] = await Promise.all([
      projectsRepository.listAccessibleProjects(user.companyId, user.id),
      projectsRepository.listAssigneesForAccessibleProjects(user.companyId, user.id),
    ]);

    if (
      user.role === "project-manager" &&
      (projectRows.length === 0 || assigneeRows.length === 0)
    ) {
      await withTransaction(async (client) => {
        await projectsRepository.ensureDefaultProjectWorkspace(
          {
            companyId: user.companyId!,
            projectId: randomUUID(),
            managerId: user.id,
          },
          client,
        );
      });

      [projectRows, assigneeRows] = await Promise.all([
        projectsRepository.listAccessibleProjects(user.companyId, user.id),
        projectsRepository.listAssigneesForAccessibleProjects(user.companyId, user.id),
      ]);
    }

    const taskResult = await projectsRepository.listTasks({
      companyId: user.companyId,
      userId: user.id,
      projectId: filters.projectId,
      assigneeId: filters.assigneeId,
      status: filters.status,
      priority: filters.priority,
      dueDateFilter: filters.dueDateFilter,
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    });
    const tasks = await hydrateTaskRows(user.companyId, taskResult.tasks);
    const permissions = buildBoardPermissions({
      role: user.role,
      hasProjects: projectRows.length > 0,
      hasAssignees: assigneeRows.length > 0,
    });

    return ok({
      viewer: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
      },
      dataSource: "api",
      permissions,
      summary: buildSummary(tasks),
      projects: projectRows.map(mapProject),
      assignees: assigneeRows.map(mapAssignee),
      tasks,
      filters,
      pagination: taskResult.pagination,
    });
  },

  async getTaskBoard(
    user: AuthenticatedUser,
    query: ProjectTaskQuery = {},
  ): Promise<ManagerServiceResult<ProjectManagerTaskBoardColumnResponse>> {
    const listResult = await this.listTasks(user, {
      ...query,
      page: 1,
      limit: 250,
    });

    if (!listResult.ok) {
      return listResult;
    }

    const tasks = listResult.data.tasks;
    const today = new Date().toISOString().slice(0, 10);
    const columns: ProjectManagerTaskBoardColumnResponse["columns"] = {
      todo: tasks.filter((task) => task.status === "To Do"),
      in_progress: tasks.filter((task) => task.status === "In Progress"),
      in_review: tasks.filter((task) => task.status === "In Review"),
      done: tasks.filter((task) => task.status === "Done"),
      blocked: tasks.filter((task) => task.status === "Blocked"),
    };

    return ok({
      columns,
      summary: listResult.data.summary,
      rightPanel: {
        tasksByPriority: {
          high: tasks.filter((task) => task.priority === "High").length,
          medium: tasks.filter((task) => task.priority === "Medium").length,
          low: tasks.filter((task) => task.priority === "Low").length,
        },
        overdueTasks: tasks
          .filter((task) => task.status !== "Done" && task.dueDate < today)
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
          .slice(0, 10),
        upcomingDeadlines: tasks
          .filter((task) => task.status !== "Done" && task.dueDate >= today)
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
          .slice(0, 10),
        myPendingReviews: tasks
          .filter((task) => task.status === "In Review" && task.reviewerId === user.id)
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
          .slice(0, 10),
      },
    });
  },

  async getTaskDetails(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<ManagerServiceResult<ProjectManagerTaskDetailsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const hydrated = await findHydratedTask(user.companyId, user.id, taskId);

    if (!hydrated) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, hydrated.row);

    return ok({
      task: hydrated.task,
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async createTask(
    user: AuthenticatedUser,
    input: CreateProjectTaskRequest,
  ): Promise<ManagerServiceResult<ProjectManagerTaskMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const project = await projectsRepository.findAccessibleProjectById(
      user.companyId,
      user.id,
      input.projectId,
    );

    if (!project) {
      return fail(404, "Project not found in your project scope.");
    }

    if (user.role !== "project-manager") {
      return fail(403, "Only Project Manager users can create project tasks here.");
    }

    const assigneeIsProjectMember = await projectsRepository.isActiveProjectMember(
      user.companyId,
      project.id,
      input.assigneeId,
    );

    if (!assigneeIsProjectMember) {
      return fail(409, "Task assignee must be an active member of the selected project.");
    }

    const createdTaskId = await withTransaction(async (client) => {
      const taskId = randomUUID();
      const taskCode = await projectsRepository.getNextTaskCode(user.companyId!, client);

      await projectsRepository.createTask(
        {
          id: taskId,
          companyId: user.companyId!,
          projectId: project.id,
          taskCode,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId,
          reporterId: user.id,
          dueDate: input.dueDate,
          estimatedMinutes: input.estimatedMinutes,
          spentMinutes: null,
          progressPercent: input.status === "done" ? 100 : 0,
          blockedReason: null,
          createdBy: user.id,
        },
        client,
      );

      for (const checklistTitle of input.checklistItems) {
        await projectsRepository.createChecklistItem(
          {
            id: randomUUID(),
            companyId: user.companyId!,
            taskId,
            title: checklistTitle,
          },
          client,
        );
      }

      await createActivity(
        {
          companyId: user.companyId!,
          taskId,
          actor: user,
          taskTitle: input.title,
          activityType: "task.created",
          description: buildActivityDescription(user.fullName, input.title, "created task"),
        },
        client,
      );

      if (input.status === "done") {
        await createActivity(
          {
            companyId: user.companyId!,
            taskId,
            actor: user,
            taskTitle: input.title,
            activityType: "task.completed",
            description: buildActivityDescription(user.fullName, input.title, "completed task"),
          },
          client,
        );
      }

      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        project.id,
        client,
      );

      return taskCode;
    });

    const hydrated = await findHydratedTask(user.companyId, user.id, createdTaskId);

    if (!hydrated) {
      return fail(404, "Created task could not be loaded.");
    }

    notifyTaskUsers(
      user.companyId,
      uniqueUserIds([hydrated.row.assigneeId], user.id),
      {
        type: "project.task.assigned",
        title: "Task assigned",
        message: `${user.fullName} assigned ${hydrated.task.title} to you.`,
        entityType: "project_task",
        entityId: hydrated.row.internalId,
      },
    );

    void auditService.recordAction(user, {
      action: "project_task.created",
      entityType: "project_task",
      entityId: hydrated.row.internalId,
      metadata: {
        taskCode: hydrated.row.taskCode,
        projectId: hydrated.row.projectId,
        assigneeId: hydrated.row.assigneeId,
      },
    });

    return ok({
      message: "Task created successfully.",
      task: hydrated.task,
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access: resolveTaskAccess(user, hydrated.row),
      }),
    });
  },

  async updateTask(
    user: AuthenticatedUser,
    taskId: string,
    input: UpdateProjectTaskRequest,
  ): Promise<ManagerServiceResult<ProjectManagerTaskMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(
      user.companyId,
      user.id,
      taskId,
    );

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canManage && !access.canAssigneeUpdate) {
      return fail(403, "You do not have access to update this task.");
    }

    const requestedFields = Object.keys(input) as Array<keyof UpdateProjectTaskRequest>;

    if (!access.canManage) {
      const allowedAssigneeFields = new Set<keyof UpdateProjectTaskRequest>([
        "status",
        "spentMinutes",
        "progressPercent",
        "blockedReason",
      ]);

      if (requestedFields.some((field) => !allowedAssigneeFields.has(field))) {
        return fail(403, "Assignees can only update task status, progress, spent time, and blockers.");
      }
    }

    if (input.assigneeId !== undefined) {
      const assigneeIsProjectMember = await projectsRepository.isActiveProjectMember(
        user.companyId,
        existing.projectId,
        input.assigneeId,
      );

      if (!assigneeIsProjectMember) {
        return fail(409, "Task assignee must be an active member of the selected project.");
      }
    }

    const changedFields = getChangedFields(existing, input);
    const nextStatus = input.status ?? existing.status;
    const completedAt =
      input.status === "done"
        ? existing.completedAt
          ? toIsoDateTime(existing.completedAt)
          : new Date().toISOString()
        : input.status && existing.status === "done"
          ? null
          : undefined;
    const progressPercent =
      input.progressPercent !== undefined
        ? input.progressPercent
        : nextStatus === "done"
          ? 100
          : undefined;

    await withTransaction(async (client) => {
      await projectsRepository.updateTask(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          ...input,
          progressPercent,
          completedAt,
        },
        client,
      );

      for (const change of changedFields) {
        await createActivity(
          {
            companyId: user.companyId!,
            taskId: existing.internalId,
            actor: user,
            taskTitle: existing.title,
            activityType: change.activityType,
            oldValue: change.oldValue,
            newValue: change.newValue,
            description: buildActivityDescription(
              user.fullName,
              existing.title,
              `changed ${String(change.field)}`,
            ),
          },
          client,
        );
      }

      if (existing.status !== "done" && nextStatus === "done") {
        await createActivity(
          {
            companyId: user.companyId!,
            taskId: existing.internalId,
            actor: user,
            taskTitle: existing.title,
            activityType: "task.completed",
            description: buildActivityDescription(user.fullName, existing.title, "completed task"),
          },
          client,
        );
      }

      if (nextStatus === "blocked" && existing.status !== "blocked") {
        await createActivity(
          {
            companyId: user.companyId!,
            taskId: existing.internalId,
            actor: user,
            taskTitle: existing.title,
            activityType: "task.blocked",
            description: buildActivityDescription(user.fullName, existing.title, "blocked task"),
          },
          client,
        );
      }

      await projectsRepository.refreshProjectMilestonesFromTasks(
        user.companyId!,
        existing.projectId,
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(
        user.companyId!,
        existing.projectId,
        client,
      );
    });

    const hydrated = await findHydratedTask(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated task could not be loaded.");
    }

    if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([input.assigneeId], user.id),
        {
          type: "project.task.assigned",
          title: "Task assigned",
          message: `${user.fullName} assigned ${hydrated.task.title} to you.`,
          entityType: "project_task",
          entityId: existing.internalId,
        },
      );
    }

    if (input.dueDate && input.dueDate !== toIsoDate(existing.dueDate)) {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([hydrated.row.assigneeId, hydrated.row.projectManagerId], user.id),
        {
          type: "project.task.due-date-changed",
          title: "Task due date changed",
          message: `${hydrated.task.title} is now due on ${hydrated.task.dueDate}.`,
          entityType: "project_task",
          entityId: existing.internalId,
        },
      );
    }

    if (nextStatus === "blocked" && existing.status !== "blocked") {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([hydrated.row.projectManagerId, hydrated.row.assigneeId], user.id),
        {
          type: "project.task.blocked",
          title: "Task blocked",
          message: `${hydrated.task.title} has been marked blocked.`,
          entityType: "project_task",
          entityId: existing.internalId,
        },
      );
    }

    if (nextStatus === "done" && existing.status !== "done") {
      notifyTaskUsers(
        user.companyId,
        uniqueUserIds([hydrated.row.projectManagerId, hydrated.row.assigneeId], user.id),
        {
          type: "project.task.completed",
          title: "Task completed",
          message: `${hydrated.task.title} has been completed.`,
          entityType: "project_task",
          entityId: existing.internalId,
        },
      );
    }

    return ok({
      message: "Task updated successfully.",
      task: hydrated.task,
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access: resolveTaskAccess(user, hydrated.row),
      }),
    });
  },

  async addChecklistItem(
    user: AuthenticatedUser,
    taskId: string,
    input: CreateProjectTaskChecklistItemRequest,
  ): Promise<ManagerServiceResult<ProjectManagerTaskChecklistMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canManage && !access.canAssigneeUpdate) {
      return fail(403, "You do not have access to update this task checklist.");
    }

    const checklistItem = await withTransaction(async (client) => {
      const created = await projectsRepository.createChecklistItem(
        {
          id: randomUUID(),
          companyId: user.companyId!,
          taskId: existing.internalId,
          title: input.title,
        },
        client,
      );

      if (!created) {
        return null;
      }

      await syncTaskProgressFromChecklist(user.companyId!, existing, client);
      await createActivity(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          actor: user,
          taskTitle: existing.title,
          activityType: "task.checklist.updated",
          description: buildActivityDescription(user.fullName, existing.title, "added checklist item"),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(user.companyId!, existing.projectId, client);

      return created;
    });

    if (!checklistItem) {
      return fail(409, "Unable to add checklist item.");
    }

    const hydrated = await findHydratedTask(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated task could not be loaded.");
    }

    return ok({
      message: "Checklist item added.",
      task: hydrated.task,
      checklistItem: mapChecklistItem(checklistItem),
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async updateChecklistItem(
    user: AuthenticatedUser,
    taskId: string,
    itemId: string,
    input: UpdateProjectTaskChecklistItemRequest,
  ): Promise<ManagerServiceResult<ProjectManagerTaskChecklistMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canManage && !access.canAssigneeUpdate) {
      return fail(403, "You do not have access to update this task checklist.");
    }

    const checklistItem = await withTransaction(async (client) => {
      const updated = await projectsRepository.updateChecklistItem(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          itemId,
          actorId: user.id,
          title: input.title,
          completed: input.completed,
        },
        client,
      );

      if (!updated) {
        return null;
      }

      await syncTaskProgressFromChecklist(user.companyId!, existing, client);
      await createActivity(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          actor: user,
          taskTitle: existing.title,
          activityType: "task.checklist.updated",
          description: buildActivityDescription(user.fullName, existing.title, "updated checklist"),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(user.companyId!, existing.projectId, client);

      return updated;
    });

    if (!checklistItem) {
      return fail(404, "Checklist item not found.");
    }

    const hydrated = await findHydratedTask(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated task could not be loaded.");
    }

    return ok({
      message: "Checklist item updated.",
      task: hydrated.task,
      checklistItem: mapChecklistItem(checklistItem),
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async deleteChecklistItem(
    user: AuthenticatedUser,
    taskId: string,
    itemId: string,
  ): Promise<ManagerServiceResult<ProjectManagerTaskMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canManage && !access.canAssigneeUpdate) {
      return fail(403, "You do not have access to update this task checklist.");
    }

    const deleted = await withTransaction(async (client) => {
      const result = await projectsRepository.deleteChecklistItem(
        user.companyId!,
        existing.internalId,
        itemId,
        client,
      );

      if (!result) {
        return false;
      }

      await syncTaskProgressFromChecklist(user.companyId!, existing, client);
      await createActivity(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          actor: user,
          taskTitle: existing.title,
          activityType: "task.checklist.updated",
          description: buildActivityDescription(user.fullName, existing.title, "deleted checklist item"),
        },
        client,
      );
      await projectsRepository.refreshProjectDeliveryState(user.companyId!, existing.projectId, client);

      return true;
    });

    if (!deleted) {
      return fail(404, "Checklist item not found.");
    }

    const hydrated = await findHydratedTask(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated task could not be loaded.");
    }

    return ok({
      message: "Checklist item deleted.",
      task: hydrated.task,
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async listTaskComments(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<ManagerServiceResult<ProjectManagerTaskCommentsResponse>> {
    const detailResult = await this.getTaskDetails(user, taskId);

    if (!detailResult.ok) {
      return detailResult;
    }

    return ok({
      comments: detailResult.data.task.comments,
    });
  },

  async addTaskComment(
    user: AuthenticatedUser,
    taskId: string,
    input: CreateProjectTaskCommentRequest,
  ): Promise<ManagerServiceResult<ProjectManagerTaskCommentMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canComment) {
      return fail(403, "You do not have access to comment on this task.");
    }

    const comment = await withTransaction(async (client) => {
      const created = await projectsRepository.createComment(
        {
          id: randomUUID(),
          companyId: user.companyId!,
          taskId: existing.internalId,
          userId: user.id,
          comment: input.comment,
          parentCommentId: input.parentCommentId ?? null,
        },
        client,
      );

      if (!created) {
        return null;
      }

      await createActivity(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          actor: user,
          taskTitle: existing.title,
          activityType: "task.comment.added",
          description: buildActivityDescription(user.fullName, existing.title, "added a comment"),
        },
        client,
      );

      return created;
    });

    if (!comment) {
      return fail(409, "Unable to add task comment.");
    }

    const hydrated = await findHydratedTask(user.companyId, user.id, existing.internalId);

    if (!hydrated) {
      return fail(404, "Updated task could not be loaded.");
    }

    notifyTaskUsers(
      user.companyId,
      uniqueUserIds([existing.assigneeId, existing.projectManagerId], user.id),
      {
        type: "project.task.comment-added",
        title: "Task comment added",
        message: `${user.fullName} commented on ${existing.title}.`,
        entityType: "project_task",
        entityId: existing.internalId,
      },
    );

    return ok({
      message: "Comment added.",
      task: hydrated.task,
      comment: mapComment(comment),
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async archiveTask(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<ManagerServiceResult<ProjectManagerTaskMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existing = await projectsRepository.findTaskById(user.companyId, user.id, taskId);

    if (!existing) {
      return fail(404, "Task not found.");
    }

    const access = resolveTaskAccess(user, existing);

    if (!access.canManage) {
      return fail(403, "Only the project manager can archive this task.");
    }

    const [taskBeforeArchive] = await hydrateTaskRows(user.companyId, [existing]);

    await withTransaction(async (client) => {
      await createActivity(
        {
          companyId: user.companyId!,
          taskId: existing.internalId,
          actor: user,
          taskTitle: existing.title,
          activityType: "task.archived",
          description: buildActivityDescription(user.fullName, existing.title, "archived task"),
        },
        client,
      );
      await projectsRepository.archiveTask(user.companyId!, existing.internalId, client);
      await projectsRepository.refreshProjectMilestonesFromTasks(user.companyId!, existing.projectId, client);
      await projectsRepository.refreshProjectDeliveryState(user.companyId!, existing.projectId, client);
    });

    return ok({
      message: "Task archived successfully.",
      task: taskBeforeArchive,
      permissions: buildBoardPermissions({
        role: user.role,
        hasProjects: true,
        hasAssignees: true,
        access,
      }),
    });
  },

  async reviewLeave(
    user: AuthenticatedUser,
    leaveId: string,
    input: UpdateManagerProjectLeaveStatusRequest,
  ): Promise<ManagerServiceResult<ManagerLeaveMutationResponse>> {
    const contextResult = await ensureManagerContext(user);

    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data;

    if (context.scope.mode !== "department") {
      return fail(
        403,
        "Manager team visibility requires a department assignment before leave review is allowed.",
      );
    }

    const existingRequest = await leaveRepository.findCompanyLeaveRequestById(
      context.company.id,
      leaveId,
    );

    if (!existingRequest) {
      return fail(404, "Leave request not found.");
    }

    const teamMember = context.teamMembers.find(
      (member) => member.id === existingRequest.userId,
    );

    if (!teamMember) {
      return fail(
        404,
        "This leave request is outside the current manager's visible team scope.",
      );
    }

    const approvalProgress = await approvalsService.getLeaveApprovalProgress(
      context.company.id,
      leaveId,
    );

    if (approvalProgress) {
      const currentStep = resolveCurrentApprovalStep(approvalProgress);

      if (!currentStep || !canUserActOnApprovalStep(user.role, currentStep.role)) {
        return fail(
          409,
          "This leave request is not currently awaiting manager review.",
        );
      }
    } else if (
      existingRequest.status !== "pending" ||
      existingRequest.managerReview.status !== "pending"
    ) {
      return fail(409, "Only pending leave requests can be reviewed here.");
    }

    const transactionResult = await withTransaction(async (client) => {
      const lockedRequest = await leaveRepository.findCompanyLeaveRequestById(
        context.company.id,
        leaveId,
        client,
      );

      if (!lockedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Leave request not found.",
        };
      }

      if (lockedRequest.status !== "pending") {
        return {
          ok: false as const,
          status: 409 as const,
          message: "Only pending leave requests can be reviewed here.",
        };
      }

      if (lockedRequest.managerReview.status !== "pending") {
        return {
          ok: false as const,
          status: 409 as const,
          message:
            "This leave request has already been reviewed at the manager layer.",
        };
      }

      const currentStep = approvalProgress
        ? resolveCurrentApprovalStep(approvalProgress)
        : null;

      if (approvalProgress && currentStep) {
        const decision = await approvalsRepository.recordApprovalDecision(
          client,
          {
            companyId: context.company.id,
            entityType: "leave",
            entityId: leaveId,
            stepId: currentStep.id,
            approverId: user.id,
            status: input.status === "rejected" ? "rejected" : "approved",
          },
        );

        if (!decision) {
          return {
            ok: false as const,
            status: 409 as const,
            message:
              "This approval step could not be updated because it is no longer pending.",
          };
        }
      }

      const updatedProgress = approvalProgress
        ? await approvalsRepository.getEntityApprovalProgress(
            context.company.id,
            "leave",
            leaveId,
            client,
          )
        : null;

      const finalRequestStatus =
        updatedProgress?.status === "approved"
          ? "approved"
          : updatedProgress?.status === "rejected"
            ? "rejected"
            : input.status === "rejected"
              ? "rejected"
              : "pending";

      const updatedRequest = await leaveRepository.updateManagerReview(
        context.company.id,
        leaveId,
        {
          status: input.status,
          reviewerUserId: user.id,
          requestStatus: finalRequestStatus,
        },
        client,
      );

      if (!updatedRequest) {
        return {
          ok: false as const,
          status: 404 as const,
          message: "Leave request not found.",
        };
      }

      return {
        ok: true as const,
        request: updatedRequest,
        approvalProgress: updatedProgress,
      };
    });

    if (!transactionResult.ok) {
      return fail(transactionResult.status, transactionResult.message);
    }

    const requestWithEmployee = {
      ...transactionResult.request,
      employee: toEmployeeSummary(teamMember),
    } satisfies HrLeaveEntry;

    const [requestWithProgress] = await approvalsService.attachLeaveApprovalProgress(
      context.company.id,
      [requestWithEmployee],
    );

    const nextStep = resolveCurrentApprovalStep(
      requestWithProgress.approvalProgress ?? null,
    );

    void notificationsService.notifyUser(context.company.id, teamMember.id, {
      type: "leave.manager.reviewed",
      title:
        input.status === "rejected"
          ? "Leave request rejected by manager"
          : nextStep?.role === "hr"
            ? "Leave request forwarded to HR"
            : "Leave request approved by manager",
      message:
        input.status === "rejected"
          ? `Your leave request for ${existingRequest.startDate} to ${existingRequest.endDate} was rejected at manager review.`
          : nextStep?.role === "hr"
            ? `Your leave request for ${existingRequest.startDate} to ${existingRequest.endDate} was approved by your manager and is pending HR review.`
            : `Your leave request for ${existingRequest.startDate} to ${existingRequest.endDate} was approved by your manager.`,
      entityType: "leave_request",
      entityId: leaveId,
    });

    if (input.status !== "rejected" && nextStep?.role === "hr") {
      void notificationsService.notifyRole(context.company.id, "hr", {
        type: "leave.manager.reviewed",
        title:
          input.status === "forwarded"
            ? "Leave forwarded to HR"
            : "Leave approved by manager",
        message: `${teamMember.fullName} has a ${existingRequest.leaveType} leave request for ${existingRequest.startDate} to ${existingRequest.endDate} ready for HR review.`,
        entityType: "leave_request",
        entityId: leaveId,
      });
    }

    void auditService.recordAction(user, {
      action:
        input.status === "rejected"
          ? "leave.rejected"
          : nextStep?.role === "hr"
            ? "leave.reviewed"
            : "leave.approved",
      entityType: "leave_request",
      entityId: leaveId,
      metadata: {
        reviewLayer: "manager",
        decision: input.status,
        reviewerRole: user.role,
        requesterId: existingRequest.userId,
        leaveType: existingRequest.leaveType,
        leavePeriod: {
          startDate: existingRequest.startDate,
          endDate: existingRequest.endDate,
        },
        nextStepRole: nextStep?.role ?? null,
      },
    });

    return ok({
      message:
        input.status === "approved"
          ? nextStep?.role === "hr"
            ? "Leave request approved at manager level and kept pending for HR."
            : "Leave request approved at manager level."
          : input.status === "forwarded"
            ? nextStep?.role === "hr"
              ? "Leave request forwarded to HR for final review."
              : "Leave request forwarded to the next approval step."
            : "Leave request rejected at manager level.",
      request: requestWithProgress,
    });
  },
};
