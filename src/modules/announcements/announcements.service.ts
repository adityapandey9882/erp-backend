import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { announcementsRepository } from "./announcements.repository.js";
import type {
  AnnouncementManagementWorkspaceResponse,
  AnnouncementMutationResponse,
  AnnouncementsServiceResult,
  CreateAnnouncementRequest,
  EmployeeAnnouncementInteractionMutationResponse,
  EmployeeAnnouncementsRecentResponse,
  EmployeeAnnouncementsWorkspaceResponse,
  UpdateAnnouncementRequest,
} from "./announcements.types.js";

function ok<T>(data: T): AnnouncementsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): AnnouncementsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}

function normalizePublishedAt(
  status: "active" | "draft" | "archived",
  publishedAt?: string | null,
) {
  if (publishedAt !== undefined) {
    return publishedAt;
  }

  return status === "active" ? new Date().toISOString() : null;
}

function readImportantFlag(input: unknown) {
  if (
    input !== null &&
    typeof input === "object" &&
    typeof (input as { isImportant?: unknown }).isImportant === "boolean"
  ) {
    return (input as { isImportant: boolean }).isImportant;
  }

  return null;
}

async function resolveCompanyContext(user: AuthenticatedUser) {
  if (!user.companyId) {
    return null;
  }

  return companiesService.getCompanyView(user.companyId);
}

export const announcementsService = {
  async getEmployeeAnnouncements(
    user: AuthenticatedUser,
  ): Promise<AnnouncementsServiceResult<EmployeeAnnouncementsWorkspaceResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, items, categories] = await Promise.all([
      resolveCompanyContext(user),
      announcementsRepository.listEmployeeAnnouncements(companyId, user.id),
      announcementsRepository.listEmployeeAnnouncementCategorySummary(companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      summary: {
        totalAnnouncements: items.length,
        unreadCount: items.filter((item) => item.seenAt === null).length,
        importantCount: items.filter((item) => item.isImportantForUser || item.isPinned).length,
        acknowledgedCount: items.filter((item) => item.acknowledgedAt !== null).length,
        highPriorityCount: items.filter((item) => item.priority === "High").length,
        pinnedCount: items.filter((item) => item.isPinned).length,
        categories,
      },
      upcoming: items.filter((item) => item.isPinned || item.priority === "High").slice(0, 3),
      items,
    });
  },

  async getEmployeeRecentAnnouncements(
    user: AuthenticatedUser,
    limit = 3,
  ): Promise<AnnouncementsServiceResult<EmployeeAnnouncementsRecentResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const items = await announcementsRepository.listEmployeeAnnouncements(
      companyId,
      user.id,
      {
        limit,
      },
    );

    return ok({
      items,
    });
  },

  async markEmployeeAnnouncementSeen(
    user: AuthenticatedUser,
    announcementId: string,
  ): Promise<AnnouncementsServiceResult<EmployeeAnnouncementInteractionMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const updatedAnnouncementId =
      await announcementsRepository.markEmployeeAnnouncementSeen(
        companyId,
        user.id,
        announcementId,
      );

    if (!updatedAnnouncementId) {
      return fail(404, "Announcement not found.");
    }

    const announcement = await announcementsRepository.findEmployeeAnnouncementById(
      companyId,
      user.id,
      updatedAnnouncementId,
    );

    if (!announcement) {
      return fail(404, "Announcement not found.");
    }

    return ok({
      message: "Announcement marked as seen.",
      announcement,
    });
  },

  async acknowledgeEmployeeAnnouncement(
    user: AuthenticatedUser,
    announcementId: string,
  ): Promise<AnnouncementsServiceResult<EmployeeAnnouncementInteractionMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const updatedAnnouncementId =
      await announcementsRepository.acknowledgeEmployeeAnnouncement(
        companyId,
        user.id,
        announcementId,
      );

    if (!updatedAnnouncementId) {
      return fail(404, "Announcement not found.");
    }

    const announcement = await announcementsRepository.findEmployeeAnnouncementById(
      companyId,
      user.id,
      updatedAnnouncementId,
    );

    if (!announcement) {
      return fail(404, "Announcement not found.");
    }

    void auditService.recordAction(user, {
      action: "announcement.acknowledged",
      entityType: "announcement",
      entityId: announcement.id,
      metadata: {
        title: announcement.title,
      },
    });

    return ok({
      message: "Announcement acknowledged.",
      announcement,
    });
  },

  async updateEmployeeAnnouncementImportance(
    user: AuthenticatedUser,
    announcementId: string,
    input: unknown,
  ): Promise<AnnouncementsServiceResult<EmployeeAnnouncementInteractionMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const isImportant = readImportantFlag(input);

    if (isImportant === null) {
      return fail(400, "A valid important flag is required.");
    }

    const updatedAnnouncementId =
      await announcementsRepository.updateEmployeeAnnouncementImportance(
        companyId,
        user.id,
        announcementId,
        isImportant,
      );

    if (!updatedAnnouncementId) {
      return fail(404, "Announcement not found.");
    }

    const announcement = await announcementsRepository.findEmployeeAnnouncementById(
      companyId,
      user.id,
      updatedAnnouncementId,
    );

    if (!announcement) {
      return fail(404, "Announcement not found.");
    }

    void auditService.recordAction(user, {
      action: isImportant ? "announcement.marked_important" : "announcement.unmarked_important",
      entityType: "announcement",
      entityId: announcement.id,
      metadata: {
        title: announcement.title,
      },
    });

    return ok({
      message: isImportant
        ? "Announcement marked as important."
        : "Announcement removed from important.",
      announcement,
    });
  },

  async getManagementWorkspace(
    user: AuthenticatedUser,
  ): Promise<AnnouncementsServiceResult<AnnouncementManagementWorkspaceResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, items] = await Promise.all([
      resolveCompanyContext(user),
      announcementsRepository.listManagementAnnouncements(companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      summary: {
        totalAnnouncements: items.length,
        activeCount: items.filter((item) => item.status === "active").length,
        draftCount: items.filter((item) => item.status === "draft").length,
        archivedCount: items.filter((item) => item.status === "archived").length,
        highPriorityCount: items.filter((item) => item.priority === "High").length,
        pinnedCount: items.filter((item) => item.isPinned).length,
      },
      items,
    });
  },

  async createAnnouncement(
    user: AuthenticatedUser,
    input: CreateAnnouncementRequest,
  ): Promise<AnnouncementsServiceResult<AnnouncementMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const createdAnnouncementId = await announcementsRepository.createAnnouncement({
      companyId,
      title: input.title,
      content: input.content,
      category: input.category,
      priority: input.priority,
      status: input.status ?? "active",
      isPinned: input.isPinned ?? false,
      publishedAt: normalizePublishedAt(input.status ?? "active", input.publishedAt),
      createdBy: user.id,
    });

    if (!createdAnnouncementId) {
      return fail(409, "Unable to create the announcement.");
    }

    const createdAnnouncement = await announcementsRepository.findAnnouncementById(
      companyId,
      createdAnnouncementId,
    );

    if (!createdAnnouncement) {
      return fail(404, "Announcement not found.");
    }

    void auditService.recordAction(user, {
      action: "announcement.created",
      entityType: "announcement",
      entityId: createdAnnouncement.id,
      metadata: {
        announcement: {
          id: createdAnnouncement.id,
          title: createdAnnouncement.title,
          category: createdAnnouncement.category,
          priority: createdAnnouncement.priority,
          status: createdAnnouncement.status,
        },
      },
    });

    return ok({
      message: "Announcement created successfully.",
      announcement: createdAnnouncement,
    });
  },

  async updateAnnouncement(
    user: AuthenticatedUser,
    announcementId: string,
    input: UpdateAnnouncementRequest,
  ): Promise<AnnouncementsServiceResult<AnnouncementMutationResponse>> {
    const companyId = user.companyId;

    if (!companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const company = await resolveCompanyContext(user);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const existingAnnouncement = await announcementsRepository.findAnnouncementById(
      companyId,
      announcementId,
    );

    if (!existingAnnouncement) {
      return fail(404, "Announcement not found.");
    }

    const updatedAnnouncementId = await announcementsRepository.updateAnnouncement({
      companyId,
      announcementId,
      title: input.title,
      content: input.content,
      category: input.category,
      priority: input.priority,
      status: input.status,
      isPinned: input.isPinned,
      publishedAt: Object.prototype.hasOwnProperty.call(input, "publishedAt")
        ? normalizePublishedAt(input.status ?? existingAnnouncement.status, input.publishedAt)
        : undefined,
      updatedBy: user.id,
    });

    if (!updatedAnnouncementId) {
      return fail(404, "Announcement not found.");
    }

    const updatedAnnouncement = await announcementsRepository.findAnnouncementById(
      companyId,
      updatedAnnouncementId,
    );

    if (!updatedAnnouncement) {
      return fail(404, "Announcement not found.");
    }

    void auditService.recordAction(user, {
      action: "announcement.updated",
      entityType: "announcement",
      entityId: updatedAnnouncement.id,
      metadata: {
        before: {
          title: existingAnnouncement.title,
          category: existingAnnouncement.category,
          priority: existingAnnouncement.priority,
          status: existingAnnouncement.status,
          isPinned: existingAnnouncement.isPinned,
          publishedAt: existingAnnouncement.publishedAt,
        },
        after: {
          title: updatedAnnouncement.title,
          category: updatedAnnouncement.category,
          priority: updatedAnnouncement.priority,
          status: updatedAnnouncement.status,
          isPinned: updatedAnnouncement.isPinned,
          publishedAt: updatedAnnouncement.publishedAt,
        },
      },
    });

    return ok({
      message: "Announcement updated successfully.",
      announcement: updatedAnnouncement,
    });
  },
};
