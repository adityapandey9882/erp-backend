import type { CompanyStatus } from "../companies/companies.types.js";
import type { HrAttendanceEntry } from "../attendance/attendance.types.js";
import type {
  HrLeaveEntry,
  UpdateManagerLeaveStatusRequest,
} from "../leave/leave.types.js";
import type { CompanyUserDepartmentSummary, CompanyUserProfile } from "../users/users.types.js";

export type ManagerScopeMode = "department" | "unassigned";

export type ManagerViewerProfile = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "role" | "status" | "department" | "designation"
> & {
  roleLabel: string;
};

export type ManagerWorkspaceScope = {
  mode: ManagerScopeMode;
  label: string;
  department: CompanyUserDepartmentSummary | null;
};

export type ManagerWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  viewer: ManagerViewerProfile;
  scope: ManagerWorkspaceScope;
  summary: {
    totalTeamMembers: number;
    activeTeamMembers: number;
    attendanceRecordsToday: number;
    openAttendanceSessions: number;
    totalLeaveRequests: number;
    pendingApprovals: number;
  };
  teamMembers: CompanyUserProfile[];
  attendance: HrAttendanceEntry[];
  leaveRequests: HrLeaveEntry[];
  approvalQueue: HrLeaveEntry[];
};

export type ManagerTeamResponse = {
  scope: ManagerWorkspaceScope;
  items: CompanyUserProfile[];
};

export type ManagerAttendanceResponse = {
  scope: ManagerWorkspaceScope;
  items: HrAttendanceEntry[];
};

export type ManagerLeaveResponse = {
  scope: ManagerWorkspaceScope;
  items: HrLeaveEntry[];
  approvalQueue: HrLeaveEntry[];
};

export type ManagerLeaveMutationResponse = {
  message: string;
  request: HrLeaveEntry;
};

export type ManagerServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type ManagerServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type ManagerServiceResult<T> =
  | ManagerServiceSuccess<T>
  | ManagerServiceFailure;

export type UpdateManagerProjectLeaveStatusRequest =
  UpdateManagerLeaveStatusRequest;

export const PROJECT_TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
] as const;

export const PROJECT_TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
export type ProjectTaskPriority = (typeof PROJECT_TASK_PRIORITIES)[number];

export type ProjectManagerTaskStatusLabel =
  | "To Do"
  | "In Progress"
  | "In Review"
  | "Done"
  | "Blocked";

export type ProjectManagerTaskPriorityLabel = "Low" | "Medium" | "High";

export type ProjectTaskDueDateFilter =
  | "all"
  | "today"
  | "upcoming"
  | "next-7-days"
  | "this-month"
  | "overdue";

export type ProjectManagerTaskProject = {
  id: string;
  code: string;
  name: string;
};

export type ProjectManagerTaskAssignee = {
  id: string;
  name: string;
  role: string;
};

export type ProjectManagerTaskChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
};

export type ProjectManagerTaskComment = {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
};

export type ProjectManagerTaskActivity = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export type ProjectManagerTaskFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
};

export type ProjectManagerTaskSubtask = {
  id: string;
  title: string;
  status: ProjectManagerTaskStatusLabel;
};

export type ProjectManagerTaskRecord = {
  id: string;
  title: string;
  project: ProjectManagerTaskProject;
  assignee: ProjectManagerTaskAssignee;
  reviewerId: string | null;
  priority: ProjectManagerTaskPriorityLabel;
  status: ProjectManagerTaskStatusLabel;
  dueDate: string;
  description: string;
  checklist: ProjectManagerTaskChecklistItem[];
  comments: ProjectManagerTaskComment[];
  activity: ProjectManagerTaskActivity[];
  files: ProjectManagerTaskFile[];
  subtasks: ProjectManagerTaskSubtask[];
  estimatedHours: number | null;
  spentHours: number | null;
  progress: number;
  lastUpdated: string;
};

export type ProjectManagerTaskBoardPermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canReview: boolean;
  canComment: boolean;
  note: string | null;
};

export type ProjectManagerTaskSummary = {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  overdue: number;
  highPriority: number;
};

export type ProjectManagerTaskFilters = {
  projectId: string | null;
  assigneeId: string | null;
  status: ProjectTaskStatus | null;
  priority: ProjectTaskPriority | null;
  dueDateFilter: ProjectTaskDueDateFilter;
  search: string;
  page: number;
  limit: number;
};

export type ProjectManagerTaskBoardResponse = {
  viewer: Pick<CompanyUserProfile, "id" | "fullName" | "role"> & {
    permissions: string[];
  };
  dataSource: "api";
  permissions: ProjectManagerTaskBoardPermissions;
  summary: ProjectManagerTaskSummary;
  projects: ProjectManagerTaskProject[];
  assignees: ProjectManagerTaskAssignee[];
  tasks: ProjectManagerTaskRecord[];
  filters: ProjectManagerTaskFilters;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ProjectManagerTaskBoardColumnResponse = {
  columns: Record<ProjectTaskStatus, ProjectManagerTaskRecord[]>;
  summary: ProjectManagerTaskSummary;
  rightPanel: {
    tasksByPriority: Record<ProjectTaskPriority, number>;
    overdueTasks: ProjectManagerTaskRecord[];
    upcomingDeadlines: ProjectManagerTaskRecord[];
    myPendingReviews: ProjectManagerTaskRecord[];
  };
};

export type ProjectManagerTaskDetailsResponse = {
  task: ProjectManagerTaskRecord;
  permissions: ProjectManagerTaskBoardPermissions;
};

export type CreateProjectTaskRequest = {
  title: string;
  projectId: string;
  assigneeId: string;
  priority: ProjectTaskPriority;
  status: ProjectTaskStatus;
  dueDate: string;
  description: string;
  estimatedMinutes: number | null;
  checklistItems: string[];
};

export type UpdateProjectTaskRequest = Partial<{
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneeId: string;
  dueDate: string;
  estimatedMinutes: number | null;
  spentMinutes: number | null;
  progressPercent: number;
  blockedReason: string | null;
}>;

export type CreateProjectTaskChecklistItemRequest = {
  title: string;
};

export type UpdateProjectTaskChecklistItemRequest = Partial<{
  title: string;
  completed: boolean;
}>;

export type CreateProjectTaskCommentRequest = {
  comment: string;
  parentCommentId?: string | null;
};

export type ProjectManagerTaskMutationResponse = {
  message: string;
  task: ProjectManagerTaskRecord;
  permissions: ProjectManagerTaskBoardPermissions;
};

export type ProjectManagerTaskChecklistMutationResponse =
  ProjectManagerTaskMutationResponse & {
    checklistItem: ProjectManagerTaskChecklistItem;
  };

export type ProjectManagerTaskCommentMutationResponse =
  ProjectManagerTaskMutationResponse & {
    comment: ProjectManagerTaskComment;
  };

export type ProjectManagerTaskCommentsResponse = {
  comments: ProjectManagerTaskComment[];
};

export const PROJECT_MILESTONE_TYPES = [
  "internal",
  "client",
  "release",
  "delivery",
  "review",
  "support",
] as const;

export const PROJECT_MILESTONE_STATUSES = [
  "upcoming",
  "on_track",
  "at_risk",
  "delayed",
  "completed",
  "cancelled",
] as const;

export const PROJECT_MILESTONE_PRIORITIES = ["low", "medium", "high"] as const;

export const PROJECT_MILESTONE_DEPENDENCY_TYPES = [
  "blocks",
  "relates_to",
  "follows",
] as const;

export type ProjectMilestoneType = (typeof PROJECT_MILESTONE_TYPES)[number];
export type ProjectMilestoneStatus = (typeof PROJECT_MILESTONE_STATUSES)[number];
export type ProjectMilestonePriority = (typeof PROJECT_MILESTONE_PRIORITIES)[number];
export type ProjectMilestoneDependencyType =
  (typeof PROJECT_MILESTONE_DEPENDENCY_TYPES)[number];

export type ProjectManagerMilestoneTypeLabel =
  | "Internal"
  | "Client"
  | "Release"
  | "Delivery"
  | "Review"
  | "Support";

export type ProjectManagerMilestoneStatusLabel =
  | "Upcoming"
  | "On Track"
  | "At Risk"
  | "Delayed"
  | "Completed"
  | "Cancelled";

export type ProjectManagerMilestonePriorityLabel = "Low" | "Medium" | "High";

export type ProjectMilestoneDueDateFilter =
  | "all"
  | "today"
  | "upcoming"
  | "next-7-days"
  | "this-month"
  | "overdue";

export type ProjectMilestoneView = "list" | "timeline";

export type ProjectManagerMilestoneProject = ProjectManagerTaskProject;

export type ProjectManagerMilestoneOwner = ProjectManagerTaskAssignee & {
  avatar: string;
};

export type ProjectManagerMilestoneLinkedTask = {
  id: string;
  internalId: string;
  title: string;
  status: ProjectManagerTaskStatusLabel;
  priority: ProjectManagerTaskPriorityLabel;
  dueDate: string;
  progress: number;
};

export type ProjectManagerMilestoneDependency = {
  id: string;
  dependencyType: ProjectMilestoneDependencyType;
  milestone: {
    id: string;
    code: string;
    title: string;
    status: ProjectManagerMilestoneStatusLabel;
    dueDate: string;
  };
  createdAt: string;
};

export type ProjectManagerMilestoneActivity = {
  id: string;
  actor: string;
  action: string;
  at: string;
};

export type ProjectManagerMilestoneFile = ProjectManagerTaskFile;

export type ProjectManagerMilestoneRecord = {
  id: string;
  internalId: string;
  title: string;
  project: ProjectManagerMilestoneProject;
  owner: ProjectManagerMilestoneOwner;
  status: ProjectManagerMilestoneStatusLabel;
  milestoneType: ProjectManagerMilestoneTypeLabel;
  phase: string;
  priority: ProjectManagerMilestonePriorityLabel;
  progress: number;
  dueDate: string;
  startDate: string | null;
  targetCompletion: string | null;
  completedAt: string | null;
  dependencies: number;
  team: ProjectManagerMilestoneOwner[];
  description: string;
  createdBy: string;
  durationDays: number | null;
  baselineProgress: number | null;
  criteria: string | null;
  tags: string[];
  linkedTasks: ProjectManagerMilestoneLinkedTask[];
  dependencyItems: ProjectManagerMilestoneDependency[];
  activity: ProjectManagerMilestoneActivity[];
  files: ProjectManagerMilestoneFile[];
  lastUpdated: string;
};

export type ProjectManagerMilestonePermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canComplete: boolean;
  canArchive: boolean;
  canLinkTasks: boolean;
  canManageDependencies: boolean;
  note: string | null;
};

export type ProjectManagerMilestoneSummary = {
  total: number;
  upcoming: number;
  completed: number;
  delayed: number;
  atRisk: number;
  onTrack: number;
  completionRate: number;
};

export type ProjectManagerMilestoneFilters = {
  projectId: string | null;
  ownerId: string | null;
  status: ProjectMilestoneStatus | null;
  priority: ProjectMilestonePriority | null;
  dueDateFilter: ProjectMilestoneDueDateFilter;
  search: string;
  view: ProjectMilestoneView;
  page: number;
  limit: number;
};

export type ProjectManagerMilestoneListResponse = {
  viewer: Pick<CompanyUserProfile, "id" | "fullName" | "role"> & {
    permissions: string[];
  };
  dataSource: "api";
  permissions: ProjectManagerMilestonePermissions;
  summary: ProjectManagerMilestoneSummary;
  projects: ProjectManagerMilestoneProject[];
  owners: ProjectManagerMilestoneOwner[];
  milestones: ProjectManagerMilestoneRecord[];
  filters: ProjectManagerMilestoneFilters;
  rightPanel: {
    upcomingDeadlines: ProjectManagerMilestoneRecord[];
    atRiskMilestones: ProjectManagerMilestoneRecord[];
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ProjectManagerMilestoneDetailsResponse = {
  milestone: ProjectManagerMilestoneRecord;
  permissions: ProjectManagerMilestonePermissions;
};

export type CreateProjectMilestoneRequest = {
  projectId: string;
  title: string;
  description: string;
  milestoneType: ProjectMilestoneType;
  phase: string;
  priority: ProjectMilestonePriority;
  ownerId: string;
  startDate: string | null;
  dueDate: string;
  targetCompletionDate: string | null;
  progressPercent: number;
  baselineProgress: number | null;
  completionCriteria: string | null;
  linkedTaskIds: string[];
  dependencyIds: string[];
};

export type UpdateProjectMilestoneRequest = Partial<{
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
}>;

export type CompleteProjectMilestoneRequest = {
  overrideReason?: string | null;
};

export type CreateProjectMilestoneDependencyRequest = {
  dependsOnMilestoneId: string;
  dependencyType: ProjectMilestoneDependencyType;
};

export type ProjectManagerMilestoneMutationResponse = {
  message: string;
  milestone: ProjectManagerMilestoneRecord;
  permissions: ProjectManagerMilestonePermissions;
};

export type ProjectManagerMilestoneDependenciesResponse = {
  dependencies: ProjectManagerMilestoneDependency[];
};

export type ProjectManagerMilestoneTasksResponse = {
  tasks: ProjectManagerMilestoneLinkedTask[];
};

export type ProjectManagerMilestoneActivityResponse = {
  activity: ProjectManagerMilestoneActivity[];
};
