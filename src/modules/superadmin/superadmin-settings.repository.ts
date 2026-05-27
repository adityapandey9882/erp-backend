import { query, type DatabaseExecutor } from "../../database/index.js";
import { normalizeCompanyModules } from "../companies/companies.types.js";
import type {
  SuperadminSettingsGeneral,
  SuperadminSettingsModules,
  SuperadminSettingsNotifications,
  SuperadminSettingsOperations,
  SuperadminSettingsSecurity,
  PlatformRuntimeView,
  SuperadminSettingsView,
} from "./superadmin.types.js";
import {
  MAINTENANCE_TARGET_ROLES,
  normalizeMaintenanceTargets,
} from "./maintenance-mode.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type SettingsRow = {
  key: string;
  value: unknown;
  updatedAt: Date | string;
};

const defaultSettings: SuperadminSettingsView = {
  general: {
    platformName: "Company Management ERP",
    platformDomain: "http://localhost:3000",
    supportEmail: "contact@companyerp.local",
    timezone: "Asia/Calcutta",
    dateFormat: "dd MMM yyyy",
  },
  security: {
    minimumPasswordLength: 8,
    enforceGlobalMfa: false,
    googleSsoEnabled: false,
    samlSsoEnabled: false,
    requireUppercase: false,
    requireNumber: false,
    requireSpecialCharacter: false,
    sessionTimeoutMinutes: 480,
  },
  notifications: {
    companyUserCreated: true,
    assetAssigned: true,
    leaveStatusChanged: true,
    procurementCreated: true,
  },
  modules: {
    defaultEnabledModules: ["admin", "employee-self"],
  },
  operations: {
    maintenanceMode: false,
    maintenanceScope: "all",
    maintenanceTargets: [...MAINTENANCE_TARGET_ROLES],
  },
};

function normalizeObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readLowercaseString(value: unknown, fallback: string) {
  return readString(value, fallback).toLowerCase();
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSupportedTimezone(value: string) {
  if (!value) {
    return false;
  }

  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone").includes(value);
    }
  } catch {
    return value.includes("/");
  }

  return value.includes("/");
}

function isSupportedDateFormat(value: string) {
  return ["dd MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"].includes(value);
}

function normalizePlatformDomain(value: unknown, fallback: string) {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return fallback;
  }

  try {
    const candidate = /^[a-z]+:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallback;
    }

    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return fallback;
  }
}

function normalizeGeneral(value: unknown): SuperadminSettingsGeneral {
  const record = normalizeObject(value);
  const rawTimezone = readString(record.timezone, "");
  const rawDateFormat = readString(record.dateFormat, "");
  const rawPlatformName = readString(record.platformName, "");
  const rawPlatformDomain = readString(record.platformDomain, "");
  const rawSupportEmail = readLowercaseString(record.supportEmail, "");

  return {
    platformName:
      rawPlatformName ||
      (rawTimezone && !isSupportedTimezone(rawTimezone)
        ? rawTimezone
        : defaultSettings.general.platformName),
    platformDomain:
      rawPlatformDomain
        ? normalizePlatformDomain(rawPlatformDomain, defaultSettings.general.platformDomain)
        : rawDateFormat && !isSupportedDateFormat(rawDateFormat)
          ? normalizePlatformDomain(rawDateFormat, defaultSettings.general.platformDomain)
          : defaultSettings.general.platformDomain,
    supportEmail:
      rawSupportEmail && isEmail(rawSupportEmail)
        ? rawSupportEmail
        : defaultSettings.general.supportEmail,
    timezone: isSupportedTimezone(rawTimezone)
      ? rawTimezone
      : defaultSettings.general.timezone,
    dateFormat: isSupportedDateFormat(rawDateFormat)
      ? rawDateFormat
      : defaultSettings.general.dateFormat,
  };
}

function normalizeSecurity(value: unknown): SuperadminSettingsSecurity {
  const record = normalizeObject(value);

  return {
    minimumPasswordLength: readPositiveInteger(
      record.minimumPasswordLength,
      defaultSettings.security.minimumPasswordLength,
    ),
    enforceGlobalMfa: readBoolean(
      record.enforceGlobalMfa,
      defaultSettings.security.enforceGlobalMfa,
    ),
    googleSsoEnabled: readBoolean(
      record.googleSsoEnabled,
      defaultSettings.security.googleSsoEnabled,
    ),
    samlSsoEnabled: readBoolean(
      record.samlSsoEnabled,
      defaultSettings.security.samlSsoEnabled,
    ),
    requireUppercase: readBoolean(
      record.requireUppercase,
      defaultSettings.security.requireUppercase,
    ),
    requireNumber: readBoolean(
      record.requireNumber,
      defaultSettings.security.requireNumber,
    ),
    requireSpecialCharacter: readBoolean(
      record.requireSpecialCharacter,
      defaultSettings.security.requireSpecialCharacter,
    ),
    sessionTimeoutMinutes: readPositiveInteger(
      record.sessionTimeoutMinutes,
      defaultSettings.security.sessionTimeoutMinutes,
    ),
  };
}

function normalizeNotifications(value: unknown): SuperadminSettingsNotifications {
  const record = normalizeObject(value);

  return {
    companyUserCreated: readBoolean(
      record.companyUserCreated,
      defaultSettings.notifications.companyUserCreated,
    ),
    assetAssigned: readBoolean(
      record.assetAssigned,
      defaultSettings.notifications.assetAssigned,
    ),
    leaveStatusChanged: readBoolean(
      record.leaveStatusChanged,
      defaultSettings.notifications.leaveStatusChanged,
    ),
    procurementCreated: readBoolean(
      record.procurementCreated,
      defaultSettings.notifications.procurementCreated,
    ),
  };
}

function normalizeModules(value: unknown): SuperadminSettingsModules {
  const record = normalizeObject(value);
  const defaultEnabledModules = Array.isArray(record.defaultEnabledModules)
    ? normalizeCompanyModules(
        record.defaultEnabledModules.map((moduleKey) =>
          typeof moduleKey === "string" ? moduleKey.trim() : "",
        ),
      )
    : defaultSettings.modules.defaultEnabledModules;

  return {
    defaultEnabledModules,
  };
}

function normalizeOperations(value: unknown): SuperadminSettingsOperations {
  const record = normalizeObject(value);
  const rawMaintenanceScope =
    typeof record.maintenanceScope === "string"
      ? record.maintenanceScope.trim().toLowerCase()
      : "";
  const maintenanceTargets = Array.isArray(record.maintenanceTargets)
    ? normalizeMaintenanceTargets(
        record.maintenanceTargets
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim()),
      )
    : defaultSettings.operations.maintenanceTargets;

  return {
    maintenanceMode: readBoolean(
      record.maintenanceMode,
      defaultSettings.operations.maintenanceMode,
    ),
    maintenanceScope:
      rawMaintenanceScope === "selected"
        ? "selected"
        : defaultSettings.operations.maintenanceScope,
    maintenanceTargets,
  };
}

function mergeRowsIntoSettings(rows: readonly SettingsRow[]): SuperadminSettingsView {
  const rowsByKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    general: normalizeGeneral(rowsByKey.get("general")),
    security: normalizeSecurity(rowsByKey.get("security")),
    notifications: normalizeNotifications(rowsByKey.get("notifications")),
    modules: normalizeModules(rowsByKey.get("modules")),
    operations: normalizeOperations(rowsByKey.get("operations")),
  };
}

export const superadminSettingsRepository = {
  getDefaultSettings() {
    return {
      general: { ...defaultSettings.general },
      security: { ...defaultSettings.security },
      notifications: { ...defaultSettings.notifications },
      modules: {
        defaultEnabledModules: [...defaultSettings.modules.defaultEnabledModules],
      },
      operations: {
        maintenanceMode: defaultSettings.operations.maintenanceMode,
        maintenanceScope: defaultSettings.operations.maintenanceScope,
        maintenanceTargets: [...defaultSettings.operations.maintenanceTargets],
      },
    } satisfies SuperadminSettingsView;
  },

  async getSettings(executor: DatabaseExecutor = defaultExecutor) {
    const result = await executor.query<SettingsRow>(
      `
        SELECT
          key,
          value,
          updated_at AS "updatedAt"
        FROM superadmin_settings
      `,
    );

    return mergeRowsIntoSettings(result.rows);
  },

  async upsertSettings(
    settings: SuperadminSettingsView,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const entries: Array<[keyof SuperadminSettingsView, unknown]> = [
      ["general", settings.general],
      ["security", settings.security],
      ["notifications", settings.notifications],
      ["modules", settings.modules],
      ["operations", settings.operations],
    ];

    for (const [key, value] of entries) {
      await executor.query(
        `
          INSERT INTO superadmin_settings (
            key,
            value,
            updated_at
          ) VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (key)
          DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
        `,
        [key, value],
      );
    }

    return this.getSettings(executor);
  },

  async getDefaultEnabledModules(executor: DatabaseExecutor = defaultExecutor) {
    const settings = await this.getSettings(executor);

    return settings.modules.defaultEnabledModules.length > 0
      ? settings.modules.defaultEnabledModules
      : defaultSettings.modules.defaultEnabledModules;
  },

  async getPlatformRuntime(executor: DatabaseExecutor = defaultExecutor) {
    const settings = await this.getSettings(executor);

    return {
      platformName: settings.general.platformName,
      platformDomain: settings.general.platformDomain,
      supportEmail: settings.general.supportEmail,
      maintenanceMode: settings.operations.maintenanceMode,
      maintenanceScope: settings.operations.maintenanceScope,
      maintenanceTargets: [...settings.operations.maintenanceTargets],
      passwordPolicy: {
        minimumPasswordLength: settings.security.minimumPasswordLength,
        requireUppercase: settings.security.requireUppercase,
        requireNumber: settings.security.requireNumber,
        requireSpecialCharacter: settings.security.requireSpecialCharacter,
      },
    } satisfies PlatformRuntimeView;
  },
};
