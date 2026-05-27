import { randomUUID } from "node:crypto";
import { query } from "../../database/index.js";
import { normalizePermissionKeys } from "../permissions/permissions.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  AuthCompanyAccess,
  AuthRole,
  AuthSessionDeviceType,
  AuthUserIdentity,
} from "./auth.types.js";

type AuthUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  companyId: string | null;
  permissions: string[] | null;
  passwordHash: string;
  passwordVersion: number;
  isActive: boolean;
};

type AdminCompanyAccessRow = {
  id: string;
  name: string;
  code: string;
};

type PasswordResetTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
  userIsActive: boolean;
  userPasswordVersion: number;
};

type TwoFactorRow = {
  id: string;
  userId: string;
  provider: "authenticator-app";
  isEnabled: boolean;
  secretEncrypted: string | null;
  pendingSecretEncrypted: string | null;
  recoveryCodesHash: string[] | null;
  enabledAt: string | null;
  disabledAt: string | null;
  lastVerifiedAt: string | null;
  setupExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  userId: string;
  deviceName: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: AuthSessionDeviceType;
  ipAddress: string | null;
  approxLocation: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isRevoked: boolean;
};

function mapAuthIdentity(
  row: AuthUserRow | undefined,
): AuthUserIdentity | null {
  if (!row || !isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role as AuthRole,
    companyId: row.companyId,
    permissions: normalizePermissionKeys(row.permissions ?? []),
    passwordHash: row.passwordHash,
    passwordVersion: row.passwordVersion,
    isActive: row.isActive,
  };
}

function mapCompanyAccess(row: AdminCompanyAccessRow): AuthCompanyAccess {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
  };
}

function mapTwoFactorRow(row: TwoFactorRow | undefined) {
  return row
    ? {
        id: row.id,
        userId: row.userId,
        provider: row.provider,
        isEnabled: row.isEnabled,
        secretEncrypted: row.secretEncrypted,
        pendingSecretEncrypted: row.pendingSecretEncrypted,
        recoveryCodesHash: row.recoveryCodesHash ?? [],
        enabledAt: row.enabledAt,
        disabledAt: row.disabledAt,
        lastVerifiedAt: row.lastVerifiedAt,
        setupExpiresAt: row.setupExpiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;
}

function mapSessionRow(row: SessionRow) {
  const expiresAt = new Date(row.expiresAt).getTime();
  const status: "active" | "revoked" | "expired" = row.isRevoked
    ? "revoked"
    : expiresAt <= Date.now()
      ? "expired"
      : "active";

  return {
    id: row.id,
    userId: row.userId,
    status,
    deviceName: row.deviceName,
    browser: row.browser,
    operatingSystem: row.operatingSystem,
    deviceType: row.deviceType,
    ipAddress: row.ipAddress,
    approxLocation: row.approxLocation,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    expiresAt: row.expiresAt,
    isRevoked: row.isRevoked,
  };
}

export const authRepository = {
  async findUserByEmail(email: string) {
    const result = await query<AuthUserRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role,
          users.company_id AS "companyId",
          users.permissions,
          users.password_hash AS "passwordHash",
          users.password_version AS "passwordVersion",
          users.is_active AS "isActive"
        FROM users
        WHERE LOWER(users.email) = LOWER($1)
        LIMIT 1
      `,
      [email.trim().toLowerCase()],
    );

    return mapAuthIdentity(result.rows[0]);
  },

  async findUserById(id: string) {
    const result = await query<AuthUserRow>(
      `
        SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          users.role,
          users.company_id AS "companyId",
          users.permissions,
          users.password_hash AS "passwordHash",
          users.password_version AS "passwordVersion",
          users.is_active AS "isActive"
        FROM users
        WHERE users.id = $1
        LIMIT 1
      `,
      [id],
    );

    return mapAuthIdentity(result.rows[0]);
  },

  async listAdminAccessibleCompanies(adminUserId: string) {
    const result = await query<AdminCompanyAccessRow>(
      `
        SELECT
          companies.id,
          companies.name,
          companies.code
        FROM company_admins
        INNER JOIN companies
          ON companies.id = company_admins.company_id
        WHERE company_admins.admin_user_id = $1
          AND companies.status = 'active'
          AND companies.onboarding_status = 'active'
          AND companies.archived_at IS NULL
        ORDER BY companies.name ASC, companies.code ASC
      `,
      [adminUserId],
    );

    return result.rows.map(mapCompanyAccess);
  },

  async findPasswordResetTokenByHash(tokenHash: string) {
    const result = await query<PasswordResetTokenRow>(
      `
        SELECT
          tokens.id,
          tokens.user_id AS "userId",
          tokens.token_hash AS "tokenHash",
          tokens.expires_at AS "expiresAt",
          tokens.used,
          tokens.created_at AS "createdAt",
          users.is_active AS "userIsActive",
          users.password_version AS "userPasswordVersion"
        FROM password_reset_tokens AS tokens
        INNER JOIN users
          ON users.id = tokens.user_id
        WHERE tokens.token_hash = $1
        LIMIT 1
      `,
      [tokenHash],
    );

    return result.rows[0] ?? null;
  },

  async updateUserPassword(userId: string, passwordHash: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE users
        SET
          password_hash = $2,
          password_version = password_version + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId, passwordHash],
    );

    return Boolean(result.rows[0]);
  },

  async invalidateUserSessions(userId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE users
        SET
          password_version = password_version + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId],
    );

    return Boolean(result.rows[0]);
  },

  async findTwoFactorByUserId(userId: string) {
    const result = await query<TwoFactorRow>(
      `
        SELECT
          auth.id,
          auth.user_id AS "userId",
          auth.provider,
          auth.is_enabled AS "isEnabled",
          auth.secret_encrypted AS "secretEncrypted",
          auth.pending_secret_encrypted AS "pendingSecretEncrypted",
          auth.recovery_codes_hash AS "recoveryCodesHash",
          auth.enabled_at AS "enabledAt",
          auth.disabled_at AS "disabledAt",
          auth.last_verified_at AS "lastVerifiedAt",
          auth.setup_expires_at AS "setupExpiresAt",
          auth.created_at AS "createdAt",
          auth.updated_at AS "updatedAt"
        FROM user_two_factor_auth AS auth
        WHERE auth.user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async upsertPendingTwoFactorSetup(userId: string, pendingSecretEncrypted: string, setupExpiresAt: Date) {
    const result = await query<TwoFactorRow>(
      `
        INSERT INTO user_two_factor_auth (
          id,
          user_id,
          provider,
          is_enabled,
          pending_secret_encrypted,
          setup_expires_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, 'authenticator-app', FALSE, $3, $4, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
          pending_secret_encrypted = EXCLUDED.pending_secret_encrypted,
          setup_expires_at = EXCLUDED.setup_expires_at,
          updated_at = NOW()
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [randomUUID(), userId, pendingSecretEncrypted, setupExpiresAt.toISOString()],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async enableTwoFactor(
    userId: string,
    secretEncrypted: string,
    recoveryCodesHash: string[],
  ) {
    const result = await query<TwoFactorRow>(
      `
        INSERT INTO user_two_factor_auth (
          id,
          user_id,
          provider,
          is_enabled,
          secret_encrypted,
          pending_secret_encrypted,
          recovery_codes_hash,
          enabled_at,
          disabled_at,
          last_verified_at,
          setup_expires_at,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          'authenticator-app',
          TRUE,
          $3,
          NULL,
          $4::text[],
          NOW(),
          NULL,
          NOW(),
          NULL,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
          provider = 'authenticator-app',
          is_enabled = TRUE,
          secret_encrypted = EXCLUDED.secret_encrypted,
          pending_secret_encrypted = NULL,
          recovery_codes_hash = EXCLUDED.recovery_codes_hash,
          enabled_at = NOW(),
          disabled_at = NULL,
          last_verified_at = NOW(),
          setup_expires_at = NULL,
          updated_at = NOW()
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [randomUUID(), userId, secretEncrypted, recoveryCodesHash],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async updateTwoFactorLastVerifiedAt(userId: string) {
    const result = await query<TwoFactorRow>(
      `
        UPDATE user_two_factor_auth
        SET
          last_verified_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [userId],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async replaceTwoFactorRecoveryCodes(userId: string, recoveryCodesHash: string[]) {
    const result = await query<TwoFactorRow>(
      `
        UPDATE user_two_factor_auth
        SET
          recovery_codes_hash = $2::text[],
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [userId, recoveryCodesHash],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async consumeRecoveryCode(userId: string, recoveryCodeHash: string) {
    const result = await query<TwoFactorRow>(
      `
        UPDATE user_two_factor_auth
        SET
          recovery_codes_hash = array_remove(recovery_codes_hash, $2),
          last_verified_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
          AND $2 = ANY(recovery_codes_hash)
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [userId, recoveryCodeHash],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async disableTwoFactor(userId: string) {
    const result = await query<TwoFactorRow>(
      `
        UPDATE user_two_factor_auth
        SET
          is_enabled = FALSE,
          secret_encrypted = NULL,
          pending_secret_encrypted = NULL,
          recovery_codes_hash = ARRAY[]::text[],
          disabled_at = NOW(),
          setup_expires_at = NULL,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          id,
          user_id AS "userId",
          provider,
          is_enabled AS "isEnabled",
          secret_encrypted AS "secretEncrypted",
          pending_secret_encrypted AS "pendingSecretEncrypted",
          recovery_codes_hash AS "recoveryCodesHash",
          enabled_at AS "enabledAt",
          disabled_at AS "disabledAt",
          last_verified_at AS "lastVerifiedAt",
          setup_expires_at AS "setupExpiresAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [userId],
    );

    return mapTwoFactorRow(result.rows[0]);
  },

  async createSession(input: {
    id: string;
    userId: string;
    deviceName: string | null;
    browser: string | null;
    operatingSystem: string | null;
    deviceType: AuthSessionDeviceType;
    ipAddress: string | null;
    approxLocation: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }) {
    const result = await query<SessionRow>(
      `
        INSERT INTO user_sessions (
          id,
          user_id,
          device_name,
          browser,
          operating_system,
          device_type,
          ip_address,
          approx_location,
          user_agent,
          last_active_at,
          expires_at,
          is_revoked,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          NOW(),
          $10,
          FALSE,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
      `,
      [
        input.id,
        input.userId,
        input.deviceName,
        input.browser,
        input.operatingSystem,
        input.deviceType,
        input.ipAddress,
        input.approxLocation,
        input.userAgent,
        input.expiresAt.toISOString(),
      ],
    );

    return mapSessionRow(result.rows[0]);
  },

  async findSessionById(sessionId: string) {
    const result = await query<SessionRow>(
      `
        SELECT
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
        FROM user_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  },

  async touchSession(sessionId: string) {
    const result = await query<SessionRow>(
      `
        UPDATE user_sessions
        SET
          last_active_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        RETURNING
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
      `,
      [sessionId],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  },

  async refreshSession(sessionId: string, expiresAt: Date) {
    const result = await query<SessionRow>(
      `
        UPDATE user_sessions
        SET
          expires_at = $2,
          last_active_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        RETURNING
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
      `,
      [sessionId, expiresAt.toISOString()],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  },

  async listSessions(userId: string) {
    const result = await query<SessionRow>(
      `
        SELECT
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
        FROM user_sessions
        WHERE user_id = $1
        ORDER BY
          CASE
            WHEN is_revoked = FALSE AND expires_at > NOW() THEN 0
            WHEN is_revoked = FALSE AND expires_at <= NOW() THEN 1
            ELSE 2
          END,
          last_active_at DESC,
          created_at DESC
      `,
      [userId],
    );

    return result.rows.map(mapSessionRow);
  },

  async listActiveSessions(userId: string) {
    const result = await query<SessionRow>(
      `
        SELECT
          id,
          user_id AS "userId",
          device_name AS "deviceName",
          browser,
          operating_system AS "operatingSystem",
          device_type AS "deviceType",
          ip_address AS "ipAddress",
          approx_location AS "approxLocation",
          user_agent AS "userAgent",
          created_at AS "createdAt",
          last_active_at AS "lastActiveAt",
          expires_at AS "expiresAt",
          is_revoked AS "isRevoked"
        FROM user_sessions
        WHERE user_id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        ORDER BY last_active_at DESC, created_at DESC
      `,
      [userId],
    );

    return result.rows.map(mapSessionRow);
  },

  async revokeSession(userId: string, sessionId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE user_sessions
        SET
          is_revoked = TRUE,
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
          AND is_revoked = FALSE
        RETURNING id
      `,
      [userId, sessionId],
    );

    return Boolean(result.rows[0]);
  },

  async revokeOtherSessions(userId: string, currentSessionId: string | null) {
    const params =
      currentSessionId !== null ? [userId, currentSessionId] : [userId];
    const predicate =
      currentSessionId !== null ? "AND id <> $2" : "";

    const result = await query<{ id: string }>(
      `
        UPDATE user_sessions
        SET
          is_revoked = TRUE,
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
          AND is_revoked = FALSE
          ${predicate}
        RETURNING id
      `,
      params,
    );

    return result.rowCount ?? 0;
  },

  async revokeAllSessionRows(userId: string) {
    const result = await query<{ id: string }>(
      `
        UPDATE user_sessions
        SET
          is_revoked = TRUE,
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
          AND is_revoked = FALSE
        RETURNING id
      `,
      [userId],
    );

    return result.rowCount ?? 0;
  },
};
