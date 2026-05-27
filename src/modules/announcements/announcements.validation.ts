import type { ValidationResult } from "../auth/auth.types.js";
import {
  isAnnouncementCategory,
  isAnnouncementPriority,
  isAnnouncementStatus,
  type CreateAnnouncementRequest,
  type UpdateAnnouncementRequest,
} from "./announcements.types.js";

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
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  return trimmed || "";
}

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function isIsoDateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function validateCreateAnnouncementPayload(
  input: unknown,
): ValidationResult<CreateAnnouncementRequest> {
  if (!input || typeof input !== "object") {
    return fail("Announcement payload is required.");
  }

  const title = normalizeText((input as Record<string, unknown>).title);
  const content = normalizeText((input as Record<string, unknown>).content);
  const categoryValue = normalizeText((input as Record<string, unknown>).category);
  const priorityValue = normalizeText((input as Record<string, unknown>).priority);
  const statusValue = normalizeText((input as Record<string, unknown>).status);
  const publishedAt = normalizeOptionalText(
    (input as Record<string, unknown>).publishedAt,
  );
  const isPinned = normalizeOptionalBoolean(
    (input as Record<string, unknown>).isPinned,
  );
  const errors: string[] = [];

  if (!title) {
    errors.push("Announcement title is required.");
  } else if (title.length > 160) {
    errors.push("Announcement title must be 160 characters or fewer.");
  }

  if (!content) {
    errors.push("Announcement content is required.");
  } else if (content.length > 5000) {
    errors.push("Announcement content must be 5000 characters or fewer.");
  }

  if (!isAnnouncementCategory(categoryValue)) {
    errors.push("Announcement category is invalid.");
  }

  if (!isAnnouncementPriority(priorityValue)) {
    errors.push("Announcement priority is invalid.");
  }

  if (statusValue && !isAnnouncementStatus(statusValue)) {
    errors.push("Announcement status is invalid.");
  }

  if (publishedAt !== undefined && publishedAt !== null && !isIsoDateTime(publishedAt)) {
    errors.push("Announcement publish date is invalid.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success({
    title,
    content,
    category: categoryValue as CreateAnnouncementRequest["category"],
    priority: priorityValue as CreateAnnouncementRequest["priority"],
    status: (statusValue || undefined) as CreateAnnouncementRequest["status"],
    isPinned,
    publishedAt: publishedAt === undefined ? undefined : publishedAt,
  });
}

export function validateUpdateAnnouncementPayload(
  input: unknown,
): ValidationResult<UpdateAnnouncementRequest> {
  if (!input || typeof input !== "object") {
    return fail("Announcement payload is required.");
  }

  const rawInput = input as Record<string, unknown>;
  const title = normalizeOptionalText(rawInput.title);
  const content = normalizeOptionalText(rawInput.content);
  const category = normalizeOptionalText(rawInput.category);
  const priority = normalizeOptionalText(rawInput.priority);
  const status = normalizeOptionalText(rawInput.status);
  const publishedAt = normalizeOptionalText(rawInput.publishedAt);
  const isPinned = normalizeOptionalBoolean(rawInput.isPinned);
  const errors: string[] = [];

  if (
    title === undefined &&
    content === undefined &&
    category === undefined &&
    priority === undefined &&
    status === undefined &&
    publishedAt === undefined &&
    isPinned === undefined
  ) {
    errors.push("At least one announcement field must be provided.");
  }

  if (title !== undefined) {
    if (!title) {
      errors.push("Announcement title cannot be empty.");
    } else if (title.length > 160) {
      errors.push("Announcement title must be 160 characters or fewer.");
    }
  }

  if (content !== undefined) {
    if (!content) {
      errors.push("Announcement content cannot be empty.");
    } else if (content.length > 5000) {
      errors.push("Announcement content must be 5000 characters or fewer.");
    }
  }

  if (category !== undefined && category !== null && !isAnnouncementCategory(category)) {
    errors.push("Announcement category is invalid.");
  }

  if (priority !== undefined && priority !== null && !isAnnouncementPriority(priority)) {
    errors.push("Announcement priority is invalid.");
  }

  if (status !== undefined && status !== null && !isAnnouncementStatus(status)) {
    errors.push("Announcement status is invalid.");
  }

  if (publishedAt !== undefined && publishedAt !== null && !isIsoDateTime(publishedAt)) {
    errors.push("Announcement publish date is invalid.");
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  const payload: UpdateAnnouncementRequest = {};

  if (title !== undefined) {
    payload.title = title as string;
  }

  if (content !== undefined) {
    payload.content = content as string;
  }

  if (category !== undefined && category !== null) {
    payload.category = category as UpdateAnnouncementRequest["category"];
  }

  if (priority !== undefined && priority !== null) {
    payload.priority = priority as UpdateAnnouncementRequest["priority"];
  }

  if (status !== undefined && status !== null) {
    payload.status = status as UpdateAnnouncementRequest["status"];
  }

  if (publishedAt !== undefined) {
    payload.publishedAt = publishedAt;
  }

  if (isPinned !== undefined) {
    payload.isPinned = isPinned;
  }

  return success(payload);
}
