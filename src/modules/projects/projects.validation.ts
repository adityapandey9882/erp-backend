import type { ValidationResult } from "../auth/auth.types.js";
import type {
  CompleteProjectMilestoneRequest,
  CreateProjectMilestoneDependencyRequest,
  CreateProjectMilestoneRequest,
  CreateProjectTaskChecklistItemRequest,
  CreateProjectTaskCommentRequest,
  CreateProjectTaskRequest,
  ProjectMilestoneDependencyType,
  ProjectMilestonePriority,
  ProjectMilestoneStatus,
  ProjectMilestoneType,
  ProjectTaskPriority,
  ProjectTaskStatus,
  UpdateProjectMilestoneRequest,
  UpdateProjectTaskChecklistItemRequest,
  UpdateProjectTaskRequest,
} from "./projects.types.js";

function fail<T>(...errors: string[]): ValidationResult<T> {
  return {
    success: false,
    errors,
  };
}

function success<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);

  return text || null;
}

function normalizeStatus(value: unknown): ProjectTaskStatus | null {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "todo" || normalized === "to do") {
    return "todo";
  }

  if (normalized === "in_progress" || normalized === "in progress") {
    return "in_progress";
  }

  if (normalized === "in_review" || normalized === "in review") {
    return "in_review";
  }

  if (normalized === "done") {
    return "done";
  }

  if (normalized === "blocked") {
    return "blocked";
  }

  return null;
}

function normalizePriority(value: unknown): ProjectTaskPriority | null {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return null;
}

function normalizeMilestoneType(value: unknown): ProjectMilestoneType | null {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");

  if (
    normalized === "internal" ||
    normalized === "client" ||
    normalized === "release" ||
    normalized === "delivery" ||
    normalized === "review" ||
    normalized === "support"
  ) {
    return normalized;
  }

  return null;
}

function normalizeMilestoneStatus(value: unknown): ProjectMilestoneStatus | null {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");

  if (
    normalized === "upcoming" ||
    normalized === "on_track" ||
    normalized === "at_risk" ||
    normalized === "delayed" ||
    normalized === "completed" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }

  return null;
}

function normalizeMilestonePriority(value: unknown): ProjectMilestonePriority | null {
  return normalizePriority(value);
}

function normalizeDependencyType(value: unknown): ProjectMilestoneDependencyType | null {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");

  if (
    normalized === "blocks" ||
    normalized === "relates_to" ||
    normalized === "follows"
  ) {
    return normalized;
  }

  return null;
}

function isDateOnlyString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function normalizeMinutes(value: unknown, fallbackValue?: unknown) {
  const source = value ?? fallbackValue;

  if (source === null || source === undefined || source === "") {
    return null;
  }

  const numeric = Number(source);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return Number.NaN;
  }

  return Math.round(numeric);
}

function normalizeHoursToMinutes(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return Number.NaN;
  }

  return Math.round(numeric * 60);
}

function normalizeProgress(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return Number.NaN;
  }

  return Math.round(numeric);
}

function normalizeProgressWithDefault(value: unknown, defaultValue: number) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  return normalizeProgress(value);
}

function normalizeOptionalDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return isDateOnlyString(text) ? text : "";
}

function normalizeTextArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 200);
}

function normalizeChecklistItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 100);
}

export function validateCreateProjectTaskPayload(
  input: unknown,
): ValidationResult<CreateProjectTaskRequest> {
  if (!input || typeof input !== "object") {
    return fail("Task payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const title = normalizeText(payload.title);
  const projectId = normalizeText(payload.projectId);
  const assigneeId = normalizeText(payload.assigneeId);
  const priority = normalizePriority(payload.priority) ?? "medium";
  const status = normalizeStatus(payload.status) ?? "todo";
  const dueDate = normalizeText(payload.dueDate);
  const description = normalizeText(payload.description);
  const estimatedMinutes =
    payload.estimatedMinutes !== undefined
      ? normalizeMinutes(payload.estimatedMinutes)
      : normalizeHoursToMinutes(payload.estimatedHours);
  const errors: string[] = [];

  if (!title) {
    errors.push("Task title is required.");
  } else if (title.length > 180) {
    errors.push("Task title must be 180 characters or fewer.");
  }

  if (!projectId) {
    errors.push("Project is required.");
  }

  if (!assigneeId) {
    errors.push("Assignee is required.");
  }

  if (!isDateOnlyString(dueDate)) {
    errors.push("A valid due date is required.");
  }

  if (Number.isNaN(estimatedMinutes)) {
    errors.push("Estimated time must be a non-negative number.");
  }

  if (description.length > 4000) {
    errors.push("Task description must be 4000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    title,
    projectId,
    assigneeId,
    priority,
    status,
    dueDate,
    description,
    estimatedMinutes,
    checklistItems: normalizeChecklistItems(payload.checklistItems),
  });
}

export function validateUpdateProjectTaskPayload(
  input: unknown,
): ValidationResult<UpdateProjectTaskRequest> {
  if (!input || typeof input !== "object") {
    return fail("Task update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const update: UpdateProjectTaskRequest = {};
  const errors: string[] = [];

  if (payload.title !== undefined) {
    const title = normalizeText(payload.title);

    if (!title) {
      errors.push("Task title cannot be empty.");
    } else if (title.length > 180) {
      errors.push("Task title must be 180 characters or fewer.");
    } else {
      update.title = title;
    }
  }

  if (payload.description !== undefined) {
    const description = normalizeText(payload.description);

    if (description.length > 4000) {
      errors.push("Task description must be 4000 characters or fewer.");
    } else {
      update.description = description;
    }
  }

  if (payload.status !== undefined) {
    const status = normalizeStatus(payload.status);

    if (!status) {
      errors.push("Task status is invalid.");
    } else {
      update.status = status;
    }
  }

  if (payload.priority !== undefined) {
    const priority = normalizePriority(payload.priority);

    if (!priority) {
      errors.push("Task priority is invalid.");
    } else {
      update.priority = priority;
    }
  }

  if (payload.assigneeId !== undefined) {
    const assigneeId = normalizeText(payload.assigneeId);

    if (!assigneeId) {
      errors.push("Assignee cannot be empty.");
    } else {
      update.assigneeId = assigneeId;
    }
  }

  if (payload.dueDate !== undefined) {
    const dueDate = normalizeText(payload.dueDate);

    if (!isDateOnlyString(dueDate)) {
      errors.push("A valid due date is required.");
    } else {
      update.dueDate = dueDate;
    }
  }

  if (payload.estimatedMinutes !== undefined || payload.estimatedHours !== undefined) {
    const estimatedMinutes =
      payload.estimatedMinutes !== undefined
        ? normalizeMinutes(payload.estimatedMinutes)
        : normalizeHoursToMinutes(payload.estimatedHours);

    if (Number.isNaN(estimatedMinutes)) {
      errors.push("Estimated time must be a non-negative number.");
    } else {
      update.estimatedMinutes = estimatedMinutes;
    }
  }

  if (payload.spentMinutes !== undefined || payload.spentHours !== undefined) {
    const spentMinutes =
      payload.spentMinutes !== undefined
        ? normalizeMinutes(payload.spentMinutes)
        : normalizeHoursToMinutes(payload.spentHours);

    if (Number.isNaN(spentMinutes)) {
      errors.push("Spent time must be a non-negative number.");
    } else {
      update.spentMinutes = spentMinutes;
    }
  }

  if (payload.progressPercent !== undefined || payload.progress !== undefined) {
    const progressPercent = normalizeProgress(
      payload.progressPercent ?? payload.progress,
    );

    if (Number.isNaN(progressPercent)) {
      errors.push("Progress must be between 0 and 100.");
    } else {
      update.progressPercent = progressPercent;
    }
  }

  if (payload.blockedReason !== undefined) {
    update.blockedReason = normalizeOptionalText(payload.blockedReason);
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  if (Object.keys(update).length === 0) {
    return fail("At least one task field must be supplied.");
  }

  return success(update);
}

export function validateCreateProjectTaskChecklistItemPayload(
  input: unknown,
): ValidationResult<CreateProjectTaskChecklistItemRequest> {
  if (!input || typeof input !== "object") {
    return fail("Checklist payload is required.");
  }

  const title = normalizeText((input as Record<string, unknown>).title);

  if (!title) {
    return fail("Checklist item title is required.");
  }

  if (title.length > 240) {
    return fail("Checklist item title must be 240 characters or fewer.");
  }

  return success({ title });
}

export function validateUpdateProjectTaskChecklistItemPayload(
  input: unknown,
): ValidationResult<UpdateProjectTaskChecklistItemRequest> {
  if (!input || typeof input !== "object") {
    return fail("Checklist update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const update: UpdateProjectTaskChecklistItemRequest = {};
  const errors: string[] = [];

  if (payload.title !== undefined) {
    const title = normalizeText(payload.title);

    if (!title) {
      errors.push("Checklist item title cannot be empty.");
    } else if (title.length > 240) {
      errors.push("Checklist item title must be 240 characters or fewer.");
    } else {
      update.title = title;
    }
  }

  if (payload.completed !== undefined) {
    update.completed = Boolean(payload.completed);
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  if (Object.keys(update).length === 0) {
    return fail("At least one checklist field must be supplied.");
  }

  return success(update);
}

export function validateCreateProjectTaskCommentPayload(
  input: unknown,
): ValidationResult<CreateProjectTaskCommentRequest> {
  if (!input || typeof input !== "object") {
    return fail("Comment payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const comment = normalizeText(payload.comment ?? payload.message);
  const parentCommentId = normalizeOptionalText(payload.parentCommentId);

  if (!comment) {
    return fail("Comment is required.");
  }

  if (comment.length > 3000) {
    return fail("Comment must be 3000 characters or fewer.");
  }

  return success({
    comment,
    parentCommentId,
  });
}

export function validateCreateProjectMilestonePayload(
  input: unknown,
): ValidationResult<CreateProjectMilestoneRequest> {
  if (!input || typeof input !== "object") {
    return fail("Milestone payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const projectId = normalizeText(payload.projectId);
  const title = normalizeText(payload.title);
  const description = normalizeText(payload.description);
  const milestoneType = normalizeMilestoneType(payload.milestoneType) ?? "internal";
  const phase = normalizeText(payload.phase) || "Planning";
  const priority = normalizeMilestonePriority(payload.priority) ?? "medium";
  const ownerId = normalizeText(payload.ownerId);
  const startDate = normalizeOptionalDate(payload.startDate);
  const dueDate = normalizeText(payload.dueDate);
  const targetCompletionDate = normalizeOptionalDate(payload.targetCompletionDate);
  const progressPercent = normalizeProgressWithDefault(payload.progressPercent, 0);
  const baselineProgress =
    payload.baselineProgress === null ||
    payload.baselineProgress === undefined ||
    payload.baselineProgress === ""
      ? null
      : normalizeProgress(payload.baselineProgress);
  const normalizedBaselineProgress =
    baselineProgress === undefined ? null : baselineProgress;
  const completionCriteria = normalizeOptionalText(payload.completionCriteria);
  const errors: string[] = [];

  if (!projectId) {
    errors.push("Project is required.");
  }

  if (!title) {
    errors.push("Milestone title is required.");
  } else if (title.length > 180) {
    errors.push("Milestone title must be 180 characters or fewer.");
  }

  if (!ownerId) {
    errors.push("Owner is required.");
  }

  if (!isDateOnlyString(dueDate)) {
    errors.push("A valid due date is required.");
  }

  if (startDate === "") {
    errors.push("Start date must be a valid date.");
  }

  if (targetCompletionDate === "") {
    errors.push("Target completion date must be a valid date.");
  }

  if (startDate && isDateOnlyString(dueDate) && dueDate < startDate) {
    errors.push("Due date cannot be before start date.");
  }

  if (Number.isNaN(progressPercent)) {
    errors.push("Progress must be between 0 and 100.");
  }

  if (Number.isNaN(normalizedBaselineProgress)) {
    errors.push("Baseline progress must be between 0 and 100.");
  }

  if (description.length > 4000) {
    errors.push("Milestone description must be 4000 characters or fewer.");
  }

  if ((completionCriteria ?? "").length > 4000) {
    errors.push("Completion criteria must be 4000 characters or fewer.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    projectId,
    title,
    description,
    milestoneType,
    phase,
    priority,
    ownerId,
    startDate,
    dueDate,
    targetCompletionDate,
    progressPercent: progressPercent ?? 0,
    baselineProgress: normalizedBaselineProgress,
    completionCriteria,
    linkedTaskIds: normalizeTextArray(payload.linkedTaskIds),
    dependencyIds: normalizeTextArray(payload.dependencyIds),
  });
}

export function validateUpdateProjectMilestonePayload(
  input: unknown,
): ValidationResult<UpdateProjectMilestoneRequest> {
  if (!input || typeof input !== "object") {
    return fail("Milestone update payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const update: UpdateProjectMilestoneRequest = {};
  const errors: string[] = [];

  if (payload.title !== undefined) {
    const title = normalizeText(payload.title);

    if (!title) {
      errors.push("Milestone title cannot be empty.");
    } else if (title.length > 180) {
      errors.push("Milestone title must be 180 characters or fewer.");
    } else {
      update.title = title;
    }
  }

  if (payload.description !== undefined) {
    const description = normalizeText(payload.description);

    if (description.length > 4000) {
      errors.push("Milestone description must be 4000 characters or fewer.");
    } else {
      update.description = description;
    }
  }

  if (payload.milestoneType !== undefined) {
    const milestoneType = normalizeMilestoneType(payload.milestoneType);

    if (!milestoneType) {
      errors.push("Milestone type is invalid.");
    } else {
      update.milestoneType = milestoneType;
    }
  }

  if (payload.phase !== undefined) {
    update.phase = normalizeText(payload.phase) || "Planning";
  }

  if (payload.status !== undefined) {
    const status = normalizeMilestoneStatus(payload.status);

    if (!status) {
      errors.push("Milestone status is invalid.");
    } else {
      update.status = status;
    }
  }

  if (payload.priority !== undefined) {
    const priority = normalizeMilestonePriority(payload.priority);

    if (!priority) {
      errors.push("Milestone priority is invalid.");
    } else {
      update.priority = priority;
    }
  }

  if (payload.ownerId !== undefined) {
    const ownerId = normalizeText(payload.ownerId);

    if (!ownerId) {
      errors.push("Owner cannot be empty.");
    } else {
      update.ownerId = ownerId;
    }
  }

  if (payload.startDate !== undefined) {
    const startDate = normalizeOptionalDate(payload.startDate);

    if (startDate === "") {
      errors.push("Start date must be a valid date.");
    } else {
      update.startDate = startDate;
    }
  }

  if (payload.dueDate !== undefined) {
    const dueDate = normalizeText(payload.dueDate);

    if (!isDateOnlyString(dueDate)) {
      errors.push("A valid due date is required.");
    } else {
      update.dueDate = dueDate;
    }
  }

  if (payload.targetCompletionDate !== undefined) {
    const targetCompletionDate = normalizeOptionalDate(payload.targetCompletionDate);

    if (targetCompletionDate === "") {
      errors.push("Target completion date must be a valid date.");
    } else {
      update.targetCompletionDate = targetCompletionDate;
    }
  }

  const nextStartDate = update.startDate;
  const nextDueDate = update.dueDate;

  if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) {
    errors.push("Due date cannot be before start date.");
  }

  if (payload.progressPercent !== undefined || payload.progress !== undefined) {
    const progressPercent = normalizeProgress(
      payload.progressPercent ?? payload.progress,
    );

    if (Number.isNaN(progressPercent)) {
      errors.push("Progress must be between 0 and 100.");
    } else {
      update.progressPercent = progressPercent;
    }
  }

  if (payload.baselineProgress !== undefined) {
    const baselineProgress =
      payload.baselineProgress === null || payload.baselineProgress === ""
        ? null
        : normalizeProgress(payload.baselineProgress);

    if (Number.isNaN(baselineProgress)) {
      errors.push("Baseline progress must be between 0 and 100.");
    } else {
      update.baselineProgress = baselineProgress;
    }
  }

  if (payload.completionCriteria !== undefined) {
    const completionCriteria = normalizeOptionalText(payload.completionCriteria);

    if ((completionCriteria ?? "").length > 4000) {
      errors.push("Completion criteria must be 4000 characters or fewer.");
    } else {
      update.completionCriteria = completionCriteria;
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  if (Object.keys(update).length === 0) {
    return fail("At least one milestone field must be supplied.");
  }

  return success(update);
}

export function validateCompleteProjectMilestonePayload(
  input: unknown,
): ValidationResult<CompleteProjectMilestoneRequest> {
  if (!input || typeof input !== "object") {
    return success({});
  }

  return success({
    overrideReason: normalizeOptionalText(
      (input as Record<string, unknown>).overrideReason,
    ),
  });
}

export function validateCreateProjectMilestoneDependencyPayload(
  input: unknown,
): ValidationResult<CreateProjectMilestoneDependencyRequest> {
  if (!input || typeof input !== "object") {
    return fail("Dependency payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const dependsOnMilestoneId = normalizeText(payload.dependsOnMilestoneId);
  const dependencyType = normalizeDependencyType(payload.dependencyType) ?? "blocks";

  if (!dependsOnMilestoneId) {
    return fail("Dependency milestone is required.");
  }

  return success({
    dependsOnMilestoneId,
    dependencyType,
  });
}
