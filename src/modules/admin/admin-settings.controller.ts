import type { Response } from "express";
import QRCode from "qrcode";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { adminSettingsService } from "./admin-settings.service.js";
import type {
  CaptureAdminLocationSessionRequest,
  CreateAdminBiometricDeviceRequest,
  CreateAdminOfficeLocationRequest,
  CreateAdminSiteLocationRequest,
  UpdateAdminAttendanceSettingsRequest,
  UpdateAdminBiometricDeviceRequest,
  UpdateAdminCompanyProfileRequest,
  UpdateAdminNotificationSettingsRequest,
  UpdateAdminOfficeLocationRequest,
  UpdateAdminSiteLocationRequest,
  UpdateAdminPayrollSettingsRequest,
} from "./admin-settings.validation.js";

function readIdParam(request: AuthenticatedRequest, key: string) {
  const value = request.params[key];
  return typeof value === "string" ? value.trim() : "";
}

function respondAuthRequired(response: Response) {
  response.status(401).json({
    message: "Authentication required.",
  });
}

function readLocationCaptureSessionIdParam(request: AuthenticatedRequest) {
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

export const adminSettingsController = {
  async getWorkspace(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.getWorkspace(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateCompanyProfile(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.updateCompanyProfile(
      request.auth,
      request.body as UpdateAdminCompanyProfileRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listOfficeLocations(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.listOfficeLocations(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createOfficeLocation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.createOfficeLocation(
      request.auth,
      request.body as CreateAdminOfficeLocationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateOfficeLocation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const officeLocationId = readIdParam(request, "officeLocationId");

    if (!officeLocationId) {
      response.status(400).json({
        message: "An office location identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.updateOfficeLocation(
      request.auth,
      officeLocationId,
      request.body as UpdateAdminOfficeLocationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deactivateOfficeLocation(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const officeLocationId = readIdParam(request, "officeLocationId");

    if (!officeLocationId) {
      response.status(400).json({
        message: "An office location identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.deactivateOfficeLocation(
      request.auth,
      officeLocationId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listSiteLocations(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.listSiteLocations(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createSiteLocation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.createSiteLocation(
      request.auth,
      request.body as CreateAdminSiteLocationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateSiteLocation(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const siteLocationId = readIdParam(request, "siteLocationId");

    if (!siteLocationId) {
      response.status(400).json({
        message: "A site location identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.updateSiteLocation(
      request.auth,
      siteLocationId,
      request.body as UpdateAdminSiteLocationRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deactivateSiteLocation(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const siteLocationId = readIdParam(request, "siteLocationId");

    if (!siteLocationId) {
      response.status(400).json({
        message: "A site location identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.deactivateSiteLocation(
      request.auth,
      siteLocationId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createOfficeLocationCaptureSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.createOfficeLocationCaptureSession(
      request.auth,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    const frontendOrigin = resolveFrontendOrigin(request);
    const qrUrl = `${frontendOrigin}/mobile/admin/office-location-capture/${encodeURIComponent(
      result.data.sessionId,
    )}?token=${encodeURIComponent(result.data.rawToken)}`;
    const qrCodeImage = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 320,
    });

    response.status(200).json({
      sessionId: result.data.sessionId,
      status: result.data.status,
      expiresAt: result.data.expiresAt,
      qrUrl,
      qrCodeImage,
    });
  },

  async getOfficeLocationCaptureSessionStatus(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const sessionId = readLocationCaptureSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({
        message: "A location capture session identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.getOfficeLocationCaptureSessionStatus(
      request.auth,
      sessionId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async cancelOfficeLocationCaptureSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const sessionId = readLocationCaptureSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({
        message: "A location capture session identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.cancelOfficeLocationCaptureSession(
      request.auth,
      sessionId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async captureOfficeLocationFromSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    const sessionId = readLocationCaptureSessionIdParam(request);

    if (!sessionId) {
      response.status(400).json({
        message: "A location capture session identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.captureOfficeLocationFromSession(
      request.auth ?? null,
      sessionId,
      request.body as CaptureAdminLocationSessionRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getAttendanceSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.getAttendanceSettings(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateAttendanceSettings(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.updateAttendanceSettings(
      request.auth,
      request.body as UpdateAdminAttendanceSettingsRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async listBiometricDevices(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.listBiometricDevices(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async createBiometricDevice(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.createBiometricDevice(
      request.auth,
      request.body as CreateAdminBiometricDeviceRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(201).json(result.data);
  },

  async updateBiometricDevice(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const deviceId = readIdParam(request, "deviceId");

    if (!deviceId) {
      response.status(400).json({
        message: "A biometric device identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.updateBiometricDevice(
      request.auth,
      deviceId,
      request.body as UpdateAdminBiometricDeviceRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async deactivateBiometricDevice(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const deviceId = readIdParam(request, "deviceId");

    if (!deviceId) {
      response.status(400).json({
        message: "A biometric device identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.deactivateBiometricDevice(
      request.auth,
      deviceId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async syncBiometricDevice(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const deviceId = readIdParam(request, "deviceId");

    if (!deviceId) {
      response.status(400).json({
        message: "A biometric device identifier is required.",
      });
      return;
    }

    const result = await adminSettingsService.syncBiometricDevice(
      request.auth,
      deviceId,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getPayrollSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.getPayrollSettings(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updatePayrollSettings(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.updatePayrollSettings(
      request.auth,
      request.body as UpdateAdminPayrollSettingsRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getNotificationSettings(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.getNotificationSettings(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateNotificationSettings(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    if (!request.auth) {
      respondAuthRequired(response);
      return;
    }

    const result = await adminSettingsService.updateNotificationSettings(
      request.auth,
      request.body as UpdateAdminNotificationSettingsRequest,
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
