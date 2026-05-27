import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import {
  normalizePermissionKeys,
  type PermissionKey,
} from "../permissions/permissions.types.js";
import { normalizeCompanyModules } from "../companies/companies.types.js";
import { isAppRole } from "../roles/roles.types.js";
import type {
  AuthEnrollmentTokenPayload,
  AuthLoginChallengeTokenPayload,
  AuthRole,
  AuthSetupTokenPayload,
  AuthTokenPayload,
} from "./auth.types.js";

type TokenInput = {
  userId: string;
  email: string;
  fullName: string;
  role: AuthRole;
  companyId?: string | null;
  enabledModules?: string[];
  sessionId?: string | null;
  passwordVersion: number;
  permissions: PermissionKey[];
  expiresInSeconds?: number;
};

type SignedToken = {
  token: string;
  issuedAt: number;
  expiresAt: number;
};

type GenericVerifiedTokenPayload = {
  kind?: string;
  sub?: string;
  email?: string;
  fullName?: string;
  role?: string;
  passwordVersion?: number;
  iat?: number;
  exp?: number;
};

function signTokenPayload(
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): SignedToken {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInSeconds;
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const signedPayload = encodeBase64Url(
    JSON.stringify({
      ...payload,
      iat: issuedAt,
      exp: expiresAt,
    }),
  );
  const signature = createSignature(`${header}.${signedPayload}`);

  return {
    token: `${header}.${signedPayload}.${signature}`,
    issuedAt,
    expiresAt,
  };
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;

  return Buffer.from(`${normalized}${"=".repeat(padding)}`, "base64").toString(
    "utf8",
  );
}

function createSignature(input: string) {
  return encodeBase64Url(
    createHmac("sha256", env.authJwtSecret).update(input).digest(),
  );
}

export function signAccessToken(input: TokenInput) {
  return signTokenPayload(
    {
      sub: input.userId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      companyId:
        typeof input.companyId === "string" || input.companyId === null
          ? input.companyId
          : undefined,
      enabledModules: normalizeCompanyModules(input.enabledModules ?? []),
      sessionId:
        typeof input.sessionId === "string" || input.sessionId === null
          ? input.sessionId
          : undefined,
      passwordVersion: input.passwordVersion,
      permissions: input.permissions,
    } satisfies Omit<AuthTokenPayload, "iat" | "exp">,
    input.expiresInSeconds ?? env.authJwtExpiresInSeconds,
  );
}

export function verifyAccessToken(token: string) {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(`${header}.${payload}`);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decodedHeader = JSON.parse(decodeBase64Url(header)) as {
      alg?: string;
      typ?: string;
    };
    const decodedPayload = JSON.parse(decodeBase64Url(payload)) as Partial<
      AuthTokenPayload
    >;

    if (decodedHeader.alg !== "HS256" || decodedHeader.typ !== "JWT") {
      return null;
    }

    if (
      !decodedPayload.sub ||
      !decodedPayload.email ||
      !decodedPayload.fullName ||
      !decodedPayload.role ||
      !isAppRole(decodedPayload.role) ||
      (decodedPayload.passwordVersion !== undefined &&
        typeof decodedPayload.passwordVersion !== "number") ||
      !Array.isArray(decodedPayload.permissions) ||
      typeof decodedPayload.iat !== "number" ||
      typeof decodedPayload.exp !== "number"
    ) {
      return null;
    }

    if (decodedPayload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      sub: decodedPayload.sub,
      email: decodedPayload.email,
      fullName: decodedPayload.fullName,
      role: decodedPayload.role,
      companyId:
        typeof decodedPayload.companyId === "string" ||
        decodedPayload.companyId === null
          ? decodedPayload.companyId
          : undefined,
      enabledModules: Array.isArray(decodedPayload.enabledModules)
        ? normalizeCompanyModules(decodedPayload.enabledModules)
        : undefined,
      sessionId:
        typeof decodedPayload.sessionId === "string" ||
        decodedPayload.sessionId === null
          ? decodedPayload.sessionId
          : undefined,
      passwordVersion: decodedPayload.passwordVersion ?? 0,
      permissions: normalizePermissionKeys(decodedPayload.permissions),
      iat: decodedPayload.iat,
      exp: decodedPayload.exp,
    } satisfies AuthTokenPayload;
  } catch {
    return null;
  }
}

export function signTwoFactorChallengeToken(input: {
  userId: string;
  email: string;
  fullName: string;
  role: AuthRole;
  passwordVersion: number;
  expiresInSeconds: number;
}) {
  return signTokenPayload(
    {
      kind: "two-factor",
      sub: input.userId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      passwordVersion: input.passwordVersion,
    } satisfies Omit<AuthLoginChallengeTokenPayload, "iat" | "exp">,
    input.expiresInSeconds,
  );
}

export function verifyTwoFactorChallengeToken(token: string) {
  const decoded = verifyGenericToken(token);

  if (!decoded || decoded.kind !== "two-factor") {
    return null;
  }

  if (
    typeof decoded.sub !== "string" ||
    typeof decoded.email !== "string" ||
    typeof decoded.fullName !== "string" ||
    typeof decoded.role !== "string" ||
    !isAppRole(decoded.role) ||
    typeof decoded.passwordVersion !== "number" ||
    typeof decoded.iat !== "number" ||
    typeof decoded.exp !== "number"
  ) {
    return null;
  }

  return decoded as AuthLoginChallengeTokenPayload;
}

export function signTwoFactorEnrollmentToken(input: {
  userId: string;
  email: string;
  fullName: string;
  role: AuthRole;
  passwordVersion: number;
  expiresInSeconds: number;
}) {
  return signTokenPayload(
    {
      kind: "two-factor-enrollment",
      sub: input.userId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      passwordVersion: input.passwordVersion,
    } satisfies Omit<AuthEnrollmentTokenPayload, "iat" | "exp">,
    input.expiresInSeconds,
  );
}

export function verifyTwoFactorEnrollmentToken(token: string) {
  const decoded = verifyGenericToken(token);

  if (!decoded || decoded.kind !== "two-factor-enrollment") {
    return null;
  }

  if (
    typeof decoded.sub !== "string" ||
    typeof decoded.email !== "string" ||
    typeof decoded.fullName !== "string" ||
    typeof decoded.role !== "string" ||
    !isAppRole(decoded.role) ||
    typeof decoded.passwordVersion !== "number" ||
    typeof decoded.iat !== "number" ||
    typeof decoded.exp !== "number"
  ) {
    return null;
  }

  return decoded as AuthEnrollmentTokenPayload;
}

export function signTwoFactorSetupToken(input: {
  userId: string;
  passwordVersion: number;
  expiresInSeconds: number;
}) {
  return signTokenPayload(
    {
      kind: "two-factor-setup",
      sub: input.userId,
      passwordVersion: input.passwordVersion,
    } satisfies Omit<AuthSetupTokenPayload, "iat" | "exp">,
    input.expiresInSeconds,
  );
}

export function verifyTwoFactorSetupToken(token: string) {
  const decoded = verifyGenericToken(token);

  if (!decoded || decoded.kind !== "two-factor-setup") {
    return null;
  }

  if (
    typeof decoded.sub !== "string" ||
    typeof decoded.passwordVersion !== "number" ||
    typeof decoded.iat !== "number" ||
    typeof decoded.exp !== "number"
  ) {
    return null;
  }

  return decoded as AuthSetupTokenPayload;
}

function verifyGenericToken(token: string) {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decodedHeader = JSON.parse(decodeBase64Url(header)) as {
      alg?: string;
      typ?: string;
    };

    if (decodedHeader.alg !== "HS256" || decodedHeader.typ !== "JWT") {
      return null;
    }

    const decodedPayload = JSON.parse(
      decodeBase64Url(payload),
    ) as GenericVerifiedTokenPayload;

    if (
      typeof decodedPayload.iat !== "number" ||
      typeof decodedPayload.exp !== "number" ||
      decodedPayload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return decodedPayload;
  } catch {
    return null;
  }
}
