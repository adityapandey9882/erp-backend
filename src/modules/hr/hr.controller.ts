import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { hrService } from "./hr.service.js";
import type {
  ImportHrEmployeesRequest,
  ReviewHrProfileChangeRequestRequest,
  UpdateHrEmployeeProfileRequest,
} from "./hr.types.js";
import type { UpdateHrLeaveStatusRequest } from "../leave/leave.types.js";
import type {
  CreateHolidayRequest,
  UpdateHolidayRequest,
} from "../admin/admin-holiday-calendar.types.js";
import type {
  CreateOffboardingRequest,
  ReviewOffboardingRequest,
} from "../offboarding/offboarding.types.js";

function readUserIdParam(request: AuthenticatedRequest) {
  const value = request.params.userId;

  return typeof value === "string" ? value.trim() : "";
}

function readLeaveIdParam(request: AuthenticatedRequest) {
  const value = request.params.leaveId;

  return typeof value === "string" ? value.trim() : "";
}

function readHolidayIdParam(request: AuthenticatedRequest) {
  const value = request.params.holidayId;

  return typeof value === "string" ? value.trim() : "";
}

function readOffboardingRequestIdParam(request: AuthenticatedRequest) {
  const value = request.params.requestId;

  return typeof value === "string" ? value.trim() : "";
}

function readProfileChangeRequestIdParam(request: AuthenticatedRequest) {
  const value = request.params.requestId;

  return typeof value === "string" ? value.trim() : "";
}

export const hrController = {
  async getOverview(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getOverview(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAttendanceWorkspace(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getAttendanceWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getLeaveWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getLeaveWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getEmployeeDirectory(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getEmployeeDirectory(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getEmployeeDetail(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "An employee identifier is required.",
      });
      return;
    }

    const result = await hrService.getEmployeeDetail(request.auth, userId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getHolidayCalendarWorkspace(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getHolidayCalendarWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createHoliday(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.createHoliday(
      request.auth,
      request.body as CreateHolidayRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateHoliday(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const holidayId = readHolidayIdParam(request);

    if (!holidayId) {
      response.status(400).json({
        message: "A holiday identifier is required.",
      });
      return;
    }

    const result = await hrService.updateHoliday(
      request.auth,
      holidayId,
      request.body as UpdateHolidayRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async importEmployees(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.importEmployees(
      request.auth,
      request.body as ImportHrEmployeesRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateEmployeeProfile(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const userId = readUserIdParam(request);

    if (!userId) {
      response.status(400).json({
        message: "An employee identifier is required.",
      });
      return;
    }

    const result = await hrService.updateEmployeeProfile(
      request.auth,
      userId,
      request.body as UpdateHrEmployeeProfileRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listProfileChangeRequests(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.listProfileChangeRequests(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async reviewProfileChangeRequest(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readProfileChangeRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "A profile change request identifier is required.",
      });
      return;
    }

    const result = await hrService.reviewProfileChangeRequest(
      request.auth,
      requestId,
      request.body as ReviewHrProfileChangeRequestRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateLeaveStatus(request: AuthenticatedRequest, response: Response) {
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

    const result = await hrService.updateLeaveStatus(
      request.auth,
      leaveId,
      request.body as UpdateHrLeaveStatusRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getOffboardingWorkspace(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.getOffboardingWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createOffboardingRequest(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const result = await hrService.createOffboardingRequest(
      request.auth,
      request.body as CreateOffboardingRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async reviewOffboardingRequest(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readOffboardingRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await hrService.reviewOffboardingRequest(
      request.auth,
      requestId,
      request.body as ReviewOffboardingRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async completeOffboardingRequest(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    const requestId = readOffboardingRequestIdParam(request);

    if (!requestId) {
      response.status(400).json({
        message: "An offboarding request identifier is required.",
      });
      return;
    }

    const result = await hrService.completeOffboardingRequest(
      request.auth,
      requestId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
