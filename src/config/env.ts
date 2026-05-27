import "dotenv/config";

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

function readStringList(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readNumber(process.env.PORT, 4000),
  appName: process.env.APP_NAME ?? "Company Management ERP API",
  apiPrefix: process.env.API_PREFIX ?? "/api/v1",
  corsAllowedOrigins: readStringList(process.env.CORS_ALLOWED_ORIGINS, [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3100",
    "http://localhost:3200",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3100",
    "http://127.0.0.1:3200",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),
  corsAllowCredentials: readBoolean(process.env.CORS_ALLOW_CREDENTIALS, true),
  databaseUrl: process.env.DATABASE_URL ?? "",
  databasePoolMax: readNumber(process.env.DATABASE_POOL_MAX, 10),
  databaseSsl: readBoolean(process.env.DATABASE_SSL, false),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseDocumentBucket:
    process.env.SUPABASE_DOCUMENT_BUCKET ?? "company-documents",
  authJwtSecret: process.env.AUTH_JWT_SECRET ?? "change-this-development-secret",
  authPasswordResetTokenSecret:
    process.env.AUTH_PASSWORD_RESET_TOKEN_SECRET ??
    process.env.AUTH_JWT_SECRET ??
    "change-this-development-secret",
  authJwtExpiresInSeconds: readNumber(
    process.env.AUTH_JWT_EXPIRES_IN_SECONDS,
    28800,
  ),
  authPasswordResetTokenExpiresInSeconds: readNumber(
    process.env.AUTH_PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS,
    1800,
  ),
  authBootstrapUserId:
    process.env.AUTH_BOOTSTRAP_USER_ID ??
    "00000000-0000-0000-0000-000000000001",
  authBootstrapName: process.env.AUTH_BOOTSTRAP_NAME ?? "ERP Superadmin",
  authBootstrapEmail:
    process.env.AUTH_BOOTSTRAP_EMAIL ?? "superadmin@companyerp.local",
  authBootstrapPassword: process.env.AUTH_BOOTSTRAP_PASSWORD ?? "Admin@12345",
  authBootstrapPasswordHash: process.env.AUTH_BOOTSTRAP_PASSWORD_HASH ?? "",
  authBootstrapRole: process.env.AUTH_BOOTSTRAP_ROLE ?? "superadmin",
  authBootstrapPermissions: readStringList(
    process.env.AUTH_BOOTSTRAP_PERMISSIONS,
    ["*"],
  ),
});
