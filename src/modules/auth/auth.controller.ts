import type { Response } from "express";
import { authService } from "./auth.service.js";
import type {
  AuthenticatedRequest,
  AuthRequestContext,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RevokeSessionRequest,
  ResetPasswordRequest,
  SelectCompanyRequest,
  TwoFactorDisableRequest,
  TwoFactorVerifyLoginRequest,
  TwoFactorVerifySetupLoginRequest,
  TwoFactorVerifySetupRequest,
} from "./auth.types.js";

function readHeaderValue(
  request: AuthenticatedRequest,
  headerName: string,
) {
  const value = request.headers[headerName.toLowerCase()];

  if (typeof value === "string") {
    return value.trim();
  }

  return Array.isArray(value) ? value[0]?.trim() ?? "" : "";
}

function inferDeviceType(userAgent: string | null): AuthRequestContext["deviceType"] {
  if (!userAgent) {
    return "unknown";
  }

  if (/ipad|tablet/i.test(userAgent)) {
    return "tablet";
  }

  if (/mobile|android|iphone/i.test(userAgent)) {
    return "mobile";
  }

  if (/windows|macintosh|linux/i.test(userAgent)) {
    return "desktop";
  }

  return "unknown";
}

function inferBrowser(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  if (/edg/i.test(userAgent)) {
    return "Microsoft Edge";
  }

  if (/chrome/i.test(userAgent) && !/edg|opr/i.test(userAgent)) {
    return "Google Chrome";
  }

  if (/firefox/i.test(userAgent)) {
    return "Mozilla Firefox";
  }

  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    return "Safari";
  }

  if (/opr|opera/i.test(userAgent)) {
    return "Opera";
  }

  return "Unknown Browser";
}

function inferOperatingSystem(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  if (/windows/i.test(userAgent)) {
    return "Windows";
  }

  if (/iphone|ipad|ios/i.test(userAgent)) {
    return "iOS";
  }

  if (/android/i.test(userAgent)) {
    return "Android";
  }

  if (/macintosh|mac os/i.test(userAgent)) {
    return "macOS";
  }

  if (/linux/i.test(userAgent)) {
    return "Linux";
  }

  return "Unknown OS";
}

function inferDeviceName(context: {
  browser: string | null;
  operatingSystem: string | null;
  deviceType: AuthRequestContext["deviceType"];
}) {
  const segments = [context.browser, context.operatingSystem].filter(Boolean);

  if (segments.length > 0) {
    return segments.join(" on ");
  }

  if (context.deviceType === "mobile") {
    return "Mobile Device";
  }

  if (context.deviceType === "tablet") {
    return "Tablet Device";
  }

  if (context.deviceType === "desktop") {
    return "Desktop Device";
  }

  return "Unknown Device";
}

function buildRequestContext(request: AuthenticatedRequest): AuthRequestContext {
  const userAgent = readHeaderValue(request, "user-agent") || null;
  const forwardedFor = readHeaderValue(request, "x-forwarded-for");
  const ipAddress =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : "") ||
    request.ip ||
    null;
  const deviceType = inferDeviceType(userAgent);
  const browser = inferBrowser(userAgent);
  const operatingSystem = inferOperatingSystem(userAgent);

  return {
    userAgent,
    ipAddress,
    approxLocation: null,
    browser,
    operatingSystem,
    deviceType,
    deviceName: inferDeviceName({ browser, operatingSystem, deviceType }),
  };
}

export const authController = {
  getStatus(_request: AuthenticatedRequest, response: Response) {
    response.status(200).json({
      module: "auth",
      status: "ready",
      endpoints: [
        "POST /login",
        "GET /me",
        "POST /select-company",
        "POST /change-password",
        "GET /2fa/status",
        "POST /2fa/setup",
        "POST /2fa/verify-setup",
        "POST /2fa/verify-login",
        "POST /2fa/verify-setup-login",
        "POST /2fa/disable",
        "POST /2fa/recovery-codes/regenerate",
        "GET /sessions",
        "POST /sessions/revoke",
        "POST /sessions/revoke-others",
        "POST /logout-all",
        "POST /forgot-password",
        "POST /reset-password",
      ],
    });
  },

  async login(request: AuthenticatedRequest, response: Response) {
    const result = await authService.login(
      request.body as LoginRequest,
      buildRequestContext(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async verifyTwoFactorLogin(request: AuthenticatedRequest, response: Response) {
    const result = await authService.verifyTwoFactorLogin(
      request.body as TwoFactorVerifyLoginRequest,
      buildRequestContext(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async verifyTwoFactorSetupLogin(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    const result = await authService.verifyTwoFactorSetupLogin(
      request.body as TwoFactorVerifySetupLoginRequest,
      buildRequestContext(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async me(request: AuthenticatedRequest, response: Response) {
    if (!request.auth) {
      response.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    response.status(200).json(await authService.getCurrentUser(request.auth));
  },

  async selectCompany(request: AuthenticatedRequest, response: Response) {
    const result = await authService.selectCompany(
      request.auth,
      request.body as SelectCompanyRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async forgotPassword(request: AuthenticatedRequest, response: Response) {
    const result = await authService.startForgotPassword(
      request.body as ForgotPasswordRequest,
    );

    response.status(202).json(result);
  },

  async changePassword(request: AuthenticatedRequest, response: Response) {
    const result = await authService.changePassword(
      request.auth,
      request.body as ChangePasswordRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getTwoFactorStatus(request: AuthenticatedRequest, response: Response) {
    const result = await authService.getTwoFactorStatus(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async beginTwoFactorSetup(request: AuthenticatedRequest, response: Response) {
    const result = await authService.beginTwoFactorSetup(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async verifyTwoFactorSetup(request: AuthenticatedRequest, response: Response) {
    const result = await authService.verifyTwoFactorSetup(
      request.auth,
      request.body as TwoFactorVerifySetupRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async disableTwoFactor(request: AuthenticatedRequest, response: Response) {
    const result = await authService.disableTwoFactor(
      request.auth,
      request.body as TwoFactorDisableRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async regenerateTwoFactorRecoveryCodes(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    const result = await authService.regenerateTwoFactorRecoveryCodes(
      request.auth,
      request.body as TwoFactorDisableRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getLoginSessions(request: AuthenticatedRequest, response: Response) {
    const result = await authService.getLoginSessions(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async revokeSession(request: AuthenticatedRequest, response: Response) {
    const result = await authService.revokeSession(
      request.auth,
      request.body as RevokeSessionRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async revokeOtherSessions(request: AuthenticatedRequest, response: Response) {
    const result = await authService.revokeOtherSessions(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async logoutAll(request: AuthenticatedRequest, response: Response) {
    const result = await authService.logoutAllSessions(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async resetPassword(request: AuthenticatedRequest, response: Response) {
    const result = await authService.resetPassword(
      request.body as ResetPasswordRequest,
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
