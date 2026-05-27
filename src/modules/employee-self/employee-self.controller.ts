import type { Response } from "express";
import QRCode from "qrcode";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { employeeSelfService } from "./employee-self.service.js";
import type { CreateEmployeeLeaveRequest } from "../leave/leave.types.js";
import type {
  CreateAttendanceQrSessionRequest,
  EmployeeAttendancePunchRequest,
  VerifyAttendanceQrSessionRequest,
} from "../attendance/attendance.types.js";
import type {
  CreateEmployeeAchievementRequest,
  CreateEmployeeEducationRequest,
  CreateEmployeeSkillRequest,
  CreateProfileChangeRequestRequest,
  UpdateEmployeeAchievementRequest,
  UpdateEmployeeEducationRequest,
  UpdateEmployeeSelfBankDetailsRequest,
  UpdateEmployeeSelfProfileRequest,
  UpdateEmployeeSelfSettingsRequest,
  UpdateEmployeeSkillRequest,
} from "./employee-self.types.js";
import type { EmployeeProfilePhotoUploadRequest } from "./employee-self.upload.js";
import { validateUploadedProfilePhoto } from "./employee-self.validation.js";

function readAssetIdParam(request: AuthenticatedRequest) {
  const value = request.params.assetId;
  return typeof value === "string" ? value.trim() : "";
}

function readEducationIdParam(request: AuthenticatedRequest) {
  const value = request.params.educationId;
  return typeof value === "string" ? value.trim() : "";
}

function readSkillIdParam(request: AuthenticatedRequest) {
  const value = request.params.skillId;
  return typeof value === "string" ? value.trim() : "";
}

function readAchievementIdParam(request: AuthenticatedRequest) {
  const value = request.params.achievementId;
  return typeof value === "string" ? value.trim() : "";
}

function readAnnouncementIdParam(request: AuthenticatedRequest) {
  const value = request.params.announcementId;
  return typeof value === "string" ? value.trim() : "";
}

function readAttendanceQrSessionIdParam(request: AuthenticatedRequest) {
  const value = request.params.sessionId;
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOriginValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveFrontendOrigin(request: AuthenticatedRequest) {
  const configuredOrigin =
    normalizeOriginValue(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOriginValue(process.env.APP_URL) ??
    normalizeOriginValue(process.env.FRONTEND_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const originHeader = normalizeOriginValue(request.get("origin"));

  if (originHeader) {
    return originHeader;
  }

  const refererHeader = normalizeOriginValue(request.get("referer"));

  if (refererHeader) {
    return refererHeader;
  }

  const forwardedProto = request.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
  }

  const host = request.get("host");

  if (host) {
    return `${request.protocol}://${host}`.replace(/\/$/, "");
  }

  return `${request.protocol}://${request.hostname}`.replace(/\/$/, "");
}

export const employeeSelfController = {
  async getOverview(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getOverview(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAttendanceWorkspace(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getAttendanceWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getOfficeLocations(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getOfficeLocations(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getSiteLocations(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getSiteLocations(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAssetsWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getAssetsWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAssetEvents(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const assetId = readAssetIdParam(request);

    if (!assetId) {
      response.status(400).json({ message: "An asset identifier is required." });
      return;
    }

    const result = await employeeSelfService.getAssetEvents(request.auth, assetId);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async checkIn(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.checkIn(
      request.auth,
      request.body as EmployeeAttendancePunchRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async checkOut(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.checkOut(
      request.auth,
      request.body as EmployeeAttendancePunchRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAttendanceQrSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.createAttendanceQrSession(
      request.auth,
      request.body as CreateAttendanceQrSessionRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    const frontendOrigin = resolveFrontendOrigin(request);
    const qrUrl = `${frontendOrigin}/mobile/attendance/verify/${encodeURIComponent(
      result.data.sessionId,
    )}?token=${encodeURIComponent(result.data.rawToken)}`;
    const qrCodeImage = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 320,
    });

    response.status(200).json({
      sessionId: result.data.sessionId,
      action: result.data.action,
      status: result.data.status,
      qrUrl,
      qrCodeImage,
      expiresAt: result.data.expiresAt,
    });
  },

  async getAttendanceQrSessionStatus(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const sessionId = readAttendanceQrSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({ message: "A QR session identifier is required." });
      return;
    }

    const result = await employeeSelfService.getAttendanceQrSessionStatus(
      request.auth,
      sessionId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async cancelAttendanceQrSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const sessionId = readAttendanceQrSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({ message: "A QR session identifier is required." });
      return;
    }

    const result = await employeeSelfService.cancelAttendanceQrSession(
      request.auth,
      sessionId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async verifyAttendanceQrSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const sessionId = readAttendanceQrSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({ message: "A QR session identifier is required." });
      return;
    }

    const result = await employeeSelfService.verifyAttendanceQrSession(
      request.auth,
      sessionId,
      request.body as VerifyAttendanceQrSessionRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getLeaveWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getLeaveWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getUpcomingCalendar(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getUpcomingCalendar(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async requestLeave(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.requestLeave(
      request.auth,
      request.body as CreateEmployeeLeaveRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getPayslips(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getPayslips(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAnnouncements(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getAnnouncements(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getRecentAnnouncements(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getRecentAnnouncements(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async markAnnouncementSeen(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const announcementId = readAnnouncementIdParam(request);

    if (!announcementId) {
      response.status(400).json({ message: "An announcement identifier is required." });
      return;
    }

    const result = await employeeSelfService.markAnnouncementSeen(
      request.auth,
      announcementId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async acknowledgeAnnouncement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const announcementId = readAnnouncementIdParam(request);

    if (!announcementId) {
      response.status(400).json({ message: "An announcement identifier is required." });
      return;
    }

    const result = await employeeSelfService.acknowledgeAnnouncement(
      request.auth,
      announcementId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateAnnouncementImportance(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const announcementId = readAnnouncementIdParam(request);

    if (!announcementId) {
      response.status(400).json({ message: "An announcement identifier is required." });
      return;
    }

    const result = await employeeSelfService.updateAnnouncementImportance(
      request.auth,
      announcementId,
      request.body,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateProfile(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.updateProfile(
      request.auth,
      request.body as UpdateEmployeeSelfProfileRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async uploadProfilePhoto(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const uploadedFile = (request as EmployeeProfilePhotoUploadRequest).file;
    const validation = validateUploadedProfilePhoto(
      uploadedFile
        ? {
            originalName: uploadedFile.originalname,
            mimeType: uploadedFile.mimetype,
            sizeBytes: uploadedFile.size,
            buffer: uploadedFile.buffer,
          }
        : null,
    );

    if (!validation.success) {
      response.status(400).json({
        message: "Validation failed.",
        errors: validation.errors,
      });
      return;
    }

    const result = await employeeSelfService.uploadProfilePhoto(request.auth, {
      fileName: validation.data.fileName,
      mimeType: validation.data.mimeType,
      fileBuffer: validation.data.buffer,
    });

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async getProfilePhoto(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getProfilePhoto(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.setHeader("Content-Type", result.data.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.status(200).send(result.data.buffer);
  },

  async getSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.getSettings(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.updateSettings(
      request.auth,
      request.body as UpdateEmployeeSelfSettingsRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateBankDetails(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.updateBankDetails(
      request.auth,
      request.body as UpdateEmployeeSelfBankDetailsRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async listEducation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.listEducation(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createEducation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.createEducation(
      request.auth,
      request.body as CreateEmployeeEducationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateEducation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const educationId = readEducationIdParam(request);

    if (!educationId) {
      response.status(400).json({ message: "An education identifier is required." });
      return;
    }

    const result = await employeeSelfService.updateEducation(
      request.auth,
      educationId,
      request.body as UpdateEmployeeEducationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteEducation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const educationId = readEducationIdParam(request);

    if (!educationId) {
      response.status(400).json({ message: "An education identifier is required." });
      return;
    }

    const result = await employeeSelfService.deleteEducation(
      request.auth,
      educationId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async listSkills(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.listSkills(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createSkill(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.createSkill(
      request.auth,
      request.body as CreateEmployeeSkillRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateSkill(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const skillId = readSkillIdParam(request);

    if (!skillId) {
      response.status(400).json({ message: "A skill identifier is required." });
      return;
    }

    const result = await employeeSelfService.updateSkill(
      request.auth,
      skillId,
      request.body as UpdateEmployeeSkillRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteSkill(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const skillId = readSkillIdParam(request);

    if (!skillId) {
      response.status(400).json({ message: "A skill identifier is required." });
      return;
    }

    const result = await employeeSelfService.deleteSkill(request.auth, skillId);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async listAchievements(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.listAchievements(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createAchievement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.createAchievement(
      request.auth,
      request.body as CreateEmployeeAchievementRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateAchievement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const achievementId = readAchievementIdParam(request);

    if (!achievementId) {
      response.status(400).json({ message: "An achievement identifier is required." });
      return;
    }

    const result = await employeeSelfService.updateAchievement(
      request.auth,
      achievementId,
      request.body as UpdateEmployeeAchievementRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async deleteAchievement(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const achievementId = readAchievementIdParam(request);

    if (!achievementId) {
      response.status(400).json({ message: "An achievement identifier is required." });
      return;
    }

    const result = await employeeSelfService.deleteAchievement(
      request.auth,
      achievementId,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async listProfileChangeRequests(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.listProfileChangeRequests(request.auth);

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(200).json(result.data);
  },

  async createProfileChangeRequest(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required." });
      return;
    }

    const result = await employeeSelfService.createProfileChangeRequest(
      request.auth,
      request.body as CreateProfileChangeRequestRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({ message: result.message });
      return;
    }

    response.status(201).json(result.data);
  },
};
