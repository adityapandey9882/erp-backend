import { Router } from "express";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { validateUpdateManagerLeaveStatusPayload } from "../leave/leave.validation.js";
import { projectsController } from "./projects.controller.js";
import {
  validateCompleteProjectMilestonePayload,
  validateCreateProjectMilestoneDependencyPayload,
  validateCreateProjectMilestonePayload,
  validateCreateProjectTaskChecklistItemPayload,
  validateCreateProjectTaskCommentPayload,
  validateCreateProjectTaskPayload,
  validateUpdateProjectMilestonePayload,
  validateUpdateProjectTaskChecklistItemPayload,
  validateUpdateProjectTaskPayload,
} from "./projects.validation.js";

const projectsRoutes = Router();

projectsRoutes.get("/", projectsController.getWorkspace);
projectsRoutes.get("/team", projectsController.getTeamMembers);
projectsRoutes.get("/attendance", projectsController.getTeamAttendance);
projectsRoutes.get("/leave", projectsController.getTeamLeave);
projectsRoutes.get("/milestones", projectsController.listMilestones);
projectsRoutes.post(
  "/milestones",
  validationMiddleware(validateCreateProjectMilestonePayload),
  projectsController.createMilestone,
);
projectsRoutes.get("/milestones/:milestoneId", projectsController.getMilestoneDetails);
projectsRoutes.patch(
  "/milestones/:milestoneId",
  validationMiddleware(validateUpdateProjectMilestonePayload),
  projectsController.updateMilestone,
);
projectsRoutes.post(
  "/milestones/:milestoneId/complete",
  validationMiddleware(validateCompleteProjectMilestonePayload),
  projectsController.completeMilestone,
);
projectsRoutes.delete("/milestones/:milestoneId", projectsController.archiveMilestone);
projectsRoutes.get(
  "/milestones/:milestoneId/dependencies",
  projectsController.listMilestoneDependencies,
);
projectsRoutes.post(
  "/milestones/:milestoneId/dependencies",
  validationMiddleware(validateCreateProjectMilestoneDependencyPayload),
  projectsController.addMilestoneDependency,
);
projectsRoutes.delete(
  "/milestones/:milestoneId/dependencies/:dependencyId",
  projectsController.removeMilestoneDependency,
);
projectsRoutes.get("/milestones/:milestoneId/tasks", projectsController.listMilestoneTasks);
projectsRoutes.post(
  "/milestones/:milestoneId/tasks/:taskId",
  projectsController.linkTaskToMilestone,
);
projectsRoutes.delete(
  "/milestones/:milestoneId/tasks/:taskId",
  projectsController.unlinkTaskFromMilestone,
);
projectsRoutes.get(
  "/milestones/:milestoneId/activity",
  projectsController.listMilestoneActivity,
);
projectsRoutes.get("/tasks", projectsController.listTasks);
projectsRoutes.get("/tasks/board", projectsController.getTaskBoard);
projectsRoutes.post(
  "/tasks",
  validationMiddleware(validateCreateProjectTaskPayload),
  projectsController.createTask,
);
projectsRoutes.get("/tasks/:taskId", projectsController.getTaskDetails);
projectsRoutes.patch(
  "/tasks/:taskId",
  validationMiddleware(validateUpdateProjectTaskPayload),
  projectsController.updateTask,
);
projectsRoutes.delete("/tasks/:taskId", projectsController.archiveTask);
projectsRoutes.post(
  "/tasks/:taskId/checklist",
  validationMiddleware(validateCreateProjectTaskChecklistItemPayload),
  projectsController.addChecklistItem,
);
projectsRoutes.patch(
  "/tasks/:taskId/checklist/:itemId",
  validationMiddleware(validateUpdateProjectTaskChecklistItemPayload),
  projectsController.updateChecklistItem,
);
projectsRoutes.delete(
  "/tasks/:taskId/checklist/:itemId",
  projectsController.deleteChecklistItem,
);
projectsRoutes.get("/tasks/:taskId/comments", projectsController.listTaskComments);
projectsRoutes.post(
  "/tasks/:taskId/comments",
  validationMiddleware(validateCreateProjectTaskCommentPayload),
  projectsController.addTaskComment,
);
projectsRoutes.patch(
  "/leave/:leaveId/review",
  validationMiddleware(validateUpdateManagerLeaveStatusPayload),
  projectsController.reviewLeave,
);

export default projectsRoutes;
