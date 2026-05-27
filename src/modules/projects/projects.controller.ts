import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { projectsService } from "./projects.service.js";
import type {
  CompleteProjectMilestoneRequest,
  CreateProjectMilestoneDependencyRequest,
  CreateProjectMilestoneRequest,
  CreateProjectTaskChecklistItemRequest,
  CreateProjectTaskCommentRequest,
  CreateProjectTaskRequest,
  ProjectMilestoneDueDateFilter,
  ProjectMilestoneView,
  ProjectTaskDueDateFilter,
  UpdateProjectMilestoneRequest,
  UpdateManagerProjectLeaveStatusRequest,
  UpdateProjectTaskChecklistItemRequest,
  UpdateProjectTaskRequest,
} from "./projects.types.js";

function readLeaveIdParam(request: AuthenticatedRequest) {
  const value = request.params.leaveId;

  return typeof value === "string" ? value.trim() : "";
}

function readTaskIdParam(request: AuthenticatedRequest) {
  const value = request.params.taskId;

  return typeof value === "string" ? value.trim() : "";
}

function readMilestoneIdParam(request: AuthenticatedRequest) {
  const value = request.params.milestoneId;

  return typeof value === "string" ? value.trim() : "";
}

function readDependencyIdParam(request: AuthenticatedRequest) {
  const value = request.params.dependencyId;

  return typeof value === "string" ? value.trim() : "";
}

function readChecklistItemIdParam(request: AuthenticatedRequest) {
  const value = request.params.itemId;

  return typeof value === "string" ? value.trim() : "";
}

function readStringQuery(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function readNumberQuery(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function readTaskQuery(request: AuthenticatedRequest) {
  return {
    projectId: readStringQuery(request.query.projectId),
    assigneeId: readStringQuery(request.query.assigneeId),
    status: readStringQuery(request.query.status),
    priority: readStringQuery(request.query.priority),
    dueDateFilter: readStringQuery(request.query.dueDateFilter) as
      | ProjectTaskDueDateFilter
      | null,
    search: readStringQuery(request.query.search),
    page: readNumberQuery(request.query.page),
    limit: readNumberQuery(request.query.limit),
  };
}

function readMilestoneQuery(request: AuthenticatedRequest) {
  return {
    projectId: readStringQuery(request.query.projectId),
    ownerId: readStringQuery(request.query.ownerId),
    status: readStringQuery(request.query.status),
    priority: readStringQuery(request.query.priority),
    dueDateFilter: readStringQuery(request.query.dueDateFilter) as
      | ProjectMilestoneDueDateFilter
      | null,
    search: readStringQuery(request.query.search),
    view: readStringQuery(request.query.view) as ProjectMilestoneView | null,
    page: readNumberQuery(request.query.page),
    limit: readNumberQuery(request.query.limit),
  };
}

export const projectsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTeamMembers(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.getTeamMembers(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTeamAttendance(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.getTeamAttendance(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTeamLeave(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.getTeamLeave(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async reviewLeave(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const leaveId = readLeaveIdParam(request);

    if (!leaveId) {
      response.status(400).json({
        message: "A leave request identifier is required.",
      });
      return;
    }

    const result = await projectsService.reviewLeave(
      request.auth,
      leaveId,
      request.body as UpdateManagerProjectLeaveStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listMilestones(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.listMilestones(
      request.auth,
      readMilestoneQuery(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.createMilestone(
      request.auth,
      request.body as CreateProjectMilestoneRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async getMilestoneDetails(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.getMilestoneDetails(
      request.auth,
      milestoneId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.updateMilestone(
      request.auth,
      milestoneId,
      request.body as UpdateProjectMilestoneRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async completeMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.completeMilestone(
      request.auth,
      milestoneId,
      request.body as CompleteProjectMilestoneRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async archiveMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.archiveMilestone(request.auth, milestoneId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listMilestoneDependencies(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.listMilestoneDependencies(
      request.auth,
      milestoneId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async addMilestoneDependency(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.addMilestoneDependency(
      request.auth,
      milestoneId,
      request.body as CreateProjectMilestoneDependencyRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async removeMilestoneDependency(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);
    const dependencyId = readDependencyIdParam(request);

    if (!milestoneId || !dependencyId) {
      response.status(400).json({
        message: "Milestone and dependency identifiers are required.",
      });
      return;
    }

    const result = await projectsService.removeMilestoneDependency(
      request.auth,
      milestoneId,
      dependencyId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listMilestoneTasks(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.listMilestoneTasks(request.auth, milestoneId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async linkTaskToMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);
    const taskId = readTaskIdParam(request);

    if (!milestoneId || !taskId) {
      response.status(400).json({
        message: "Milestone and task identifiers are required.",
      });
      return;
    }

    const result = await projectsService.linkTaskToMilestone(
      request.auth,
      milestoneId,
      taskId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async unlinkTaskFromMilestone(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);
    const taskId = readTaskIdParam(request);

    if (!milestoneId || !taskId) {
      response.status(400).json({
        message: "Milestone and task identifiers are required.",
      });
      return;
    }

    const result = await projectsService.unlinkTaskFromMilestone(
      request.auth,
      milestoneId,
      taskId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listMilestoneActivity(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const milestoneId = readMilestoneIdParam(request);

    if (!milestoneId) {
      response.status(400).json({
        message: "A milestone identifier is required.",
      });
      return;
    }

    const result = await projectsService.listMilestoneActivity(
      request.auth,
      milestoneId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listTasks(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.listTasks(
      request.auth,
      readTaskQuery(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTaskBoard(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.getTaskBoard(
      request.auth,
      readTaskQuery(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTaskDetails(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.getTaskDetails(request.auth, taskId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createTask(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await projectsService.createTask(
      request.auth,
      request.body as CreateProjectTaskRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateTask(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.updateTask(
      request.auth,
      taskId,
      request.body as UpdateProjectTaskRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async addChecklistItem(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.addChecklistItem(
      request.auth,
      taskId,
      request.body as CreateProjectTaskChecklistItemRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateChecklistItem(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);
    const itemId = readChecklistItemIdParam(request);

    if (!taskId || !itemId) {
      response.status(400).json({
        message: "Task and checklist item identifiers are required.",
      });
      return;
    }

    const result = await projectsService.updateChecklistItem(
      request.auth,
      taskId,
      itemId,
      request.body as UpdateProjectTaskChecklistItemRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteChecklistItem(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);
    const itemId = readChecklistItemIdParam(request);

    if (!taskId || !itemId) {
      response.status(400).json({
        message: "Task and checklist item identifiers are required.",
      });
      return;
    }

    const result = await projectsService.deleteChecklistItem(
      request.auth,
      taskId,
      itemId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listTaskComments(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.listTaskComments(request.auth, taskId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async addTaskComment(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.addTaskComment(
      request.auth,
      taskId,
      request.body as CreateProjectTaskCommentRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async archiveTask(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const taskId = readTaskIdParam(request);

    if (!taskId) {
      response.status(400).json({
        message: "A task identifier is required.",
      });
      return;
    }

    const result = await projectsService.archiveTask(request.auth, taskId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
