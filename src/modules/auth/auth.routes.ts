import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware.js";
import { maintenanceModeMiddleware } from "../../core/middleware/maintenance-mode.middleware.js";
import { validationMiddleware } from "../../core/middleware/validation.middleware.js";
import { authController } from "./auth.controller.js";
import {
  validateChangePasswordPayload,
  validateForgotPasswordPayload,
  validateLoginPayload,
  validateRevokeSessionPayload,
  validateResetPasswordPayload,
  validateSelectCompanyPayload,
  validateTwoFactorDisablePayload,
  validateTwoFactorVerifyLoginPayload,
  validateTwoFactorVerifySetupLoginPayload,
  validateTwoFactorVerifySetupPayload,
} from "./auth.validation.js";

const authRoutes = Router();

authRoutes.get("/", authController.getStatus);
authRoutes.post("/login", validationMiddleware(validateLoginPayload), authController.login);
authRoutes.get("/me", authMiddleware, maintenanceModeMiddleware, authController.me);
authRoutes.post(
  "/2fa/verify-login",
  maintenanceModeMiddleware,
  validationMiddleware(validateTwoFactorVerifyLoginPayload),
  authController.verifyTwoFactorLogin,
);
authRoutes.post(
  "/2fa/verify-setup-login",
  maintenanceModeMiddleware,
  validationMiddleware(validateTwoFactorVerifySetupLoginPayload),
  authController.verifyTwoFactorSetupLogin,
);
authRoutes.post(
  "/select-company",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateSelectCompanyPayload),
  authController.selectCompany,
);
authRoutes.post(
  "/change-password",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateChangePasswordPayload),
  authController.changePassword,
);
authRoutes.get(
  "/2fa/status",
  authMiddleware,
  maintenanceModeMiddleware,
  authController.getTwoFactorStatus,
);
authRoutes.post(
  "/2fa/setup",
  authMiddleware,
  maintenanceModeMiddleware,
  authController.beginTwoFactorSetup,
);
authRoutes.post(
  "/2fa/verify-setup",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateTwoFactorVerifySetupPayload),
  authController.verifyTwoFactorSetup,
);
authRoutes.post(
  "/2fa/disable",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateTwoFactorDisablePayload),
  authController.disableTwoFactor,
);
authRoutes.post(
  "/2fa/recovery-codes/regenerate",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateTwoFactorDisablePayload),
  authController.regenerateTwoFactorRecoveryCodes,
);
authRoutes.get(
  "/sessions",
  authMiddleware,
  maintenanceModeMiddleware,
  authController.getLoginSessions,
);
authRoutes.post(
  "/sessions/revoke",
  authMiddleware,
  maintenanceModeMiddleware,
  validationMiddleware(validateRevokeSessionPayload),
  authController.revokeSession,
);
authRoutes.post(
  "/sessions/revoke-others",
  authMiddleware,
  maintenanceModeMiddleware,
  authController.revokeOtherSessions,
);
authRoutes.post(
  "/logout-all",
  authMiddleware,
  maintenanceModeMiddleware,
  authController.logoutAll,
);
authRoutes.post(
  "/forgot-password",
  validationMiddleware(validateForgotPasswordPayload),
  authController.forgotPassword,
);
authRoutes.post(
  "/reset-password",
  validationMiddleware(validateResetPasswordPayload),
  authController.resetPassword,
);

export default authRoutes;
