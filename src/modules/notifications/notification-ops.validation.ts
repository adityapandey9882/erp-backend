import type { ValidationResult } from "../auth/auth.types.js";
import {
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_RULE_SEVERITIES,
} from "./notification-ops.types.js";
import type {
  UpdateNotificationPolicyRequest,
  UpdateNotificationRuleRequest,
} from "./notification-ops.types.js";

function fail<T>(...errors: string[]): ValidationResult<T> {
  return {
    success: false,
    errors,
  };
}

function success<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeInteger(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

export function validateUpdateNotificationRulePayload(
  input: unknown,
): ValidationResult<UpdateNotificationRuleRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Notification rule payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one notification rule field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) => !["enabled", "channels", "severity"].includes(key),
  );

  if (invalidKeys.length > 0) {
    return fail("Only enabled, channels, and severity can be updated here.");
  }

  const data: UpdateNotificationRuleRequest = {};
  const errors: string[] = [];

  if ("enabled" in payload) {
    const enabled = normalizeBoolean(payload.enabled);

    if (enabled === null) {
      errors.push("Enabled must be a boolean value.");
    } else {
      data.enabled = enabled;
    }
  }

  if ("channels" in payload) {
    if (!Array.isArray(payload.channels) || payload.channels.length === 0) {
      errors.push("Channels must be a non-empty array.");
    } else {
      const channels = payload.channels.filter(
        (value): value is string => typeof value === "string",
      );

      if (
        channels.length !== payload.channels.length ||
        channels.some(
          (channel) =>
            !NOTIFICATION_DELIVERY_CHANNELS.includes(
              channel as (typeof NOTIFICATION_DELIVERY_CHANNELS)[number],
            ),
        )
      ) {
        errors.push("Channels must contain only supported delivery values.");
      } else {
        data.channels =
          channels as UpdateNotificationRuleRequest["channels"];
      }
    }
  }

  if ("severity" in payload) {
    const severity =
      typeof payload.severity === "string" ? payload.severity.trim() : "";

    if (
      !NOTIFICATION_RULE_SEVERITIES.includes(
        severity as (typeof NOTIFICATION_RULE_SEVERITIES)[number],
      )
    ) {
      errors.push("Severity must be one of the supported notification values.");
    } else {
      data.severity =
        severity as UpdateNotificationRuleRequest["severity"];
    }
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}

export function validateUpdateNotificationPolicyPayload(
  input: unknown,
): ValidationResult<UpdateNotificationPolicyRequest> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Notification policy payload is required.");
  }

  const payload = input as Record<string, unknown>;
  const providedKeys = Object.keys(payload);

  if (providedKeys.length === 0) {
    return fail("At least one notification policy field must be provided.");
  }

  const invalidKeys = providedKeys.filter(
    (key) =>
      ![
        "reminderEnabled",
        "reminderIntervalMinutes",
        "maxRetries",
        "escalationEnabled",
        "escalationAfterMinutes",
      ].includes(key),
  );

  if (invalidKeys.length > 0) {
    return fail(
      "Only reminderEnabled, reminderIntervalMinutes, maxRetries, escalationEnabled, and escalationAfterMinutes can be updated here.",
    );
  }

  const data: UpdateNotificationPolicyRequest = {};
  const errors: string[] = [];

  if ("reminderEnabled" in payload) {
    const reminderEnabled = normalizeBoolean(payload.reminderEnabled);

    if (reminderEnabled === null) {
      errors.push("Reminder enabled must be a boolean value.");
    } else {
      data.reminderEnabled = reminderEnabled;
    }
  }

  if ("reminderIntervalMinutes" in payload) {
    if (payload.reminderIntervalMinutes === null) {
      data.reminderIntervalMinutes = null;
    } else {
      const value = normalizeInteger(payload.reminderIntervalMinutes);

      if (value === null || value < 1 || value > 10080) {
        errors.push("Reminder interval must be between 1 and 10080 minutes.");
      } else {
        data.reminderIntervalMinutes = value;
      }
    }
  }

  if ("maxRetries" in payload) {
    const maxRetries = normalizeInteger(payload.maxRetries);

    if (maxRetries === null || maxRetries < 1 || maxRetries > 25) {
      errors.push("Max retries must be between 1 and 25.");
    } else {
      data.maxRetries = maxRetries;
    }
  }

  if ("escalationEnabled" in payload) {
    const escalationEnabled = normalizeBoolean(payload.escalationEnabled);

    if (escalationEnabled === null) {
      errors.push("Escalation enabled must be a boolean value.");
    } else {
      data.escalationEnabled = escalationEnabled;
    }
  }

  if ("escalationAfterMinutes" in payload) {
    if (payload.escalationAfterMinutes === null) {
      data.escalationAfterMinutes = null;
    } else {
      const value = normalizeInteger(payload.escalationAfterMinutes);

      if (value === null || value < 1 || value > 10080) {
        errors.push("Escalation after must be between 1 and 10080 minutes.");
      } else {
        data.escalationAfterMinutes = value;
      }
    }
  }

  const reminderEnabled =
    typeof data.reminderEnabled === "boolean" ? data.reminderEnabled : null;
  const escalationEnabled =
    typeof data.escalationEnabled === "boolean" ? data.escalationEnabled : null;

  if (
    reminderEnabled === true &&
    !("reminderIntervalMinutes" in data)
  ) {
    errors.push(
      "Reminder interval minutes must be provided when reminders are enabled.",
    );
  }

  if (
    escalationEnabled === true &&
    !("escalationAfterMinutes" in data)
  ) {
    errors.push(
      "Escalation after minutes must be provided when escalation is enabled.",
    );
  }

  if (errors.length > 0) {
    return fail(...errors);
  }

  return success(data);
}
