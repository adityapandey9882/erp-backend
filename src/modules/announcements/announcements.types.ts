import type { CompanyStatus } from "../companies/companies.types.js";

export const ANNOUNCEMENT_CATEGORIES = [
  "HR",
  "IT",
  "Admin",
  "Facilities",
  "Finance",
  "Others",
] as const;

export const ANNOUNCEMENT_PRIORITIES = ["High", "Medium", "Low"] as const;

export const ANNOUNCEMENT_STATUSES = [
  "active",
  "draft",
  "archived",
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export type AnnouncementRecord = {
  id: string;
  companyId: string;
  title: string;
  content: string;
  summary: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  isPinned: boolean;
  isNew: boolean;
  seenAt: string | null;
  acknowledgedAt: string | null;
  isImportantForUser: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementCreatorSummary = {
  id: string;
  fullName: string;
  email: string;
  profilePhotoUrl: string | null;
};

export type AnnouncementManagementRecord = AnnouncementRecord & {
  createdBy: AnnouncementCreatorSummary | null;
  audienceTotal: number;
  seenCount: number;
  acknowledgedCount: number;
};

export type EmployeeAnnouncementCategorySummary = {
  category: AnnouncementCategory;
  count: number;
};

export type EmployeeAnnouncementsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalAnnouncements: number;
    unreadCount: number;
    importantCount: number;
    acknowledgedCount: number;
    highPriorityCount: number;
    pinnedCount: number;
    categories: EmployeeAnnouncementCategorySummary[];
  };
  upcoming: AnnouncementRecord[];
  items: AnnouncementRecord[];
};

export type EmployeeAnnouncementsRecentResponse = {
  items: AnnouncementRecord[];
};

export type AnnouncementManagementWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  summary: {
    totalAnnouncements: number;
    activeCount: number;
    draftCount: number;
    archivedCount: number;
    highPriorityCount: number;
    pinnedCount: number;
  };
  items: AnnouncementManagementRecord[];
};

export type CreateAnnouncementRequest = {
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status?: AnnouncementStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
};

export type UpdateAnnouncementRequest = {
  title?: string;
  content?: string;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
};

export type AnnouncementMutationResponse = {
  message: string;
  announcement: AnnouncementRecord;
};

export type EmployeeAnnouncementInteractionMutationResponse = {
  message: string;
  announcement: AnnouncementRecord;
};

export type AnnouncementsServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AnnouncementsServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type AnnouncementsServiceResult<T> =
  | AnnouncementsServiceSuccess<T>
  | AnnouncementsServiceFailure;

export function isAnnouncementCategory(
  value: string,
): value is AnnouncementCategory {
  return ANNOUNCEMENT_CATEGORIES.includes(value as AnnouncementCategory);
}

export function isAnnouncementPriority(
  value: string,
): value is AnnouncementPriority {
  return ANNOUNCEMENT_PRIORITIES.includes(value as AnnouncementPriority);
}

export function isAnnouncementStatus(
  value: string,
): value is AnnouncementStatus {
  return ANNOUNCEMENT_STATUSES.includes(value as AnnouncementStatus);
}
