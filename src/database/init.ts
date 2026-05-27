import { access, readdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../config/env.js";
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_BLUEPRINT,
  normalizePermissionKeys,
} from "../modules/permissions/permissions.types.js";
import {
  ERP_ROLES,
  ROLE_DEFINITIONS,
  isAppRole,
} from "../modules/roles/roles.types.js";
import { hashPassword } from "../modules/auth/auth.password.js";
import { query, withTransaction } from "./query.js";

type CountRow = {
  count: string;
};

type DatabaseNowRow = {
  now: string;
};

function resolveBootstrapRole(role: string) {
  return isAppRole(role) ? role : "superadmin";
}

function buildBootstrapUser() {
  const role = resolveBootstrapRole(env.authBootstrapRole);
  const permissions =
    env.authBootstrapPermissions.length > 0
      ? normalizePermissionKeys(env.authBootstrapPermissions)
      : [];

  return {
    id: env.authBootstrapUserId,
    fullName: env.authBootstrapName,
    email: env.authBootstrapEmail.toLowerCase(),
    role,
    permissions,
    passwordHash:
      env.authBootstrapPasswordHash || hashPassword(env.authBootstrapPassword),
    isActive: true,
  };
}

function splitPermissionKey(permissionKey: string) {
  const separatorIndex = permissionKey.indexOf(":");

  if (separatorIndex < 0) {
    return {
      module: permissionKey,
      action: "all",
    };
  }

  return {
    module: permissionKey.slice(0, separatorIndex),
    action: permissionKey.slice(separatorIndex + 1),
  };
}

async function ensureAccessControlSeed() {
  const permissionRows = Object.values(PERMISSION_DEFINITIONS).filter(
    (permission) => permission.key !== "*",
  );
  const systemRoles = ERP_ROLES.map((role) => ROLE_DEFINITIONS[role]);

  const existingPermissions = await query<{ id: string; key: string }>(
    "SELECT id, key FROM permissions",
  );
  const existingRoles = await query<{ id: string; code: string }>(
    `
      SELECT id, code
      FROM roles
      WHERE company_id IS NULL
    `,
  );

  const permissionIdByKey = new Map(
    existingPermissions.rows.map((row) => [row.key.toLowerCase(), row.id]),
  );
  const roleIdByCode = new Map(
    existingRoles.rows.map((row) => [row.code.toLowerCase(), row.id]),
  );

  await withTransaction(async (client) => {
    for (const permission of permissionRows) {
      const permissionKey = permission.key.toLowerCase();

      if (!permissionIdByKey.has(permissionKey)) {
        const seedId = randomUUID();
        const { module, action } = splitPermissionKey(permission.key);

        await client.query(
          `
            INSERT INTO permissions (
              id,
              key,
              module,
              action,
              description,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          `,
          [seedId, permission.key, module, action, permission.description],
        );

        permissionIdByKey.set(permissionKey, seedId);
      }
    }

    for (const roleDefinition of systemRoles) {
      const roleCode = roleDefinition.role.toLowerCase();

      if (!roleIdByCode.has(roleCode)) {
        const seedId = randomUUID();

        await client.query(
          `
            INSERT INTO roles (
              id,
              company_id,
              code,
              name,
              description,
              is_system,
              created_at,
              updated_at
            ) VALUES ($1, NULL, $2, $3, $4, TRUE, NOW(), NOW())
          `,
          [
            seedId,
            roleDefinition.role,
            roleDefinition.label,
            roleDefinition.description,
          ],
        );

        roleIdByCode.set(roleCode, seedId);
      }
    }

    for (const role of ERP_ROLES) {
      const roleId = roleIdByCode.get(role.toLowerCase());

      if (!roleId) {
        continue;
      }

      for (const permissionKey of ROLE_PERMISSION_BLUEPRINT[role]) {
        if (permissionKey === "*") {
          continue;
        }

        const permissionId = permissionIdByKey.get(permissionKey.toLowerCase());

        if (!permissionId) {
          continue;
        }

        await client.query(
          `
            INSERT INTO role_permissions (
              id,
              role_id,
              permission_id,
              created_at
            ) VALUES ($1, $2, $3, NOW())
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [randomUUID(), roleId, permissionId],
        );
      }
    }
  });
}

async function resolveMigrationsDirectory() {
  const candidates = [
    path.resolve(process.cwd(), "src/database/migrations"),
    path.resolve(process.cwd(), "backend/src/database/migrations"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.R_OK);
      return candidate;
    } catch {
      // Keep trying the next candidate.
    }
  }

  throw new Error("Database migrations directory could not be resolved.");
}

async function ensureMigrationTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function runMigrations() {
  await ensureMigrationTable();

  const migrationsDirectory = await resolveMigrationsDirectory();
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  if (filenames.length === 0) {
    console.log("ℹ️ No migration files found.");
    return;
  }

  for (const filename of filenames) {
    const alreadyApplied = await query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1",
      [filename],
    );

    if (alreadyApplied.rowCount) {
      console.log(`⏭️ Migration already applied: ${filename}`);
      continue;
    }

    console.log(`🔄 Applying migration: ${filename}`);

    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");

    await withTransaction(async (client) => {
      if (sql.trim()) {
        await client.query(sql);
      }

      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
        [filename],
      );
    });

    console.log(`✅ Migration applied: ${filename}`);
  }
}

async function ensureBootstrapUser() {
  const result = await query<CountRow>(
    "SELECT COUNT(*)::text AS count FROM users",
  );
  const userCount = Number(result.rows[0]?.count ?? "0");

  if (userCount > 0) {
    console.log("✅ Bootstrap user check complete: users already exist.");
    return;
  }

  const bootstrapUser = buildBootstrapUser();

  await query(
    `
      INSERT INTO users (
        id,
        full_name,
        email,
        role,
        permissions,
        password_hash,
        is_active
      ) VALUES ($1, $2, $3, $4, $5::text[], $6, $7)
    `,
    [
      bootstrapUser.id,
      bootstrapUser.fullName,
      bootstrapUser.email,
      bootstrapUser.role,
      bootstrapUser.permissions,
      bootstrapUser.passwordHash,
      bootstrapUser.isActive,
    ],
  );

  console.log(
    `✅ Bootstrap user created successfully: ${bootstrapUser.email}`,
  );
}

export async function initializeDatabase() {
  console.log("🔄 Checking database connection...");

  const connectionResult = await query<DatabaseNowRow>(
    "SELECT NOW()::text AS now",
  );

  console.log(
    `✅ Database connected successfully at ${connectionResult.rows[0]?.now}`,
  );

  console.log("🔄 Running migrations...");
  await runMigrations();
  console.log("✅ Migrations check complete.");

  console.log("🔄 Ensuring access-control seed data...");
  await ensureAccessControlSeed();
  console.log("✅ Access-control seed data ready.");

  console.log("🔄 Ensuring bootstrap user...");
  await ensureBootstrapUser();
  console.log("✅ Database initialization complete.");
}
