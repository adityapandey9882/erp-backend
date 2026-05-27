import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { notificationOpsService } from "./notification-ops.service.js";
import type {
  NotificationDeliveryChannel,
  NotificationDeliveryLogFilters,
  NotificationDeliveryStatus,
  UpdateNotificationPolicyRequest,
  UpdateNotificationRuleRequest,
} from "./notification-ops.types.js";

function readParam(request: AuthenticatedRequest, key: string) {
  const value = request.params[key];
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalQueryValue(
  request: AuthenticatedRequest,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = request.query[key];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function readOptionalPositiveInteger(
  request: AuthenticatedRequest,
  keys: readonly string[],
) {
  const value = readOptionalQueryValue(request, keys);

  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function readDeliveryLogFilters(request: AuthenticatedRequest): NotificationDeliveryLogFilters {
  const status = readOptionalQueryValue(request, ["status"]);
  const channel = readOptionalQueryValue(request, ["channel"]);

  return {
    status:
      status === "delivered" ||
      status === "failed" ||
      status === "pending" ||
      status === "retry-queued"
        ? (status as NotificationDeliveryStatus)
        : undefined,
    channel:
      channel === "in-app" || channel === "email" || channel === "sms"
        ? (channel as NotificationDeliveryChannel)
        : undefined,
    companyId: readOptionalQueryValue(request, ["companyId", "company"]),
    dateFrom: readOptionalQueryValue(request, ["dateFrom", "from"]),
    dateTo: readOptionalQueryValue(request, ["dateTo", "to"]),
    page: readOptionalPositiveInteger(request, ["page"]),
    pageSize: readOptionalPositiveInteger(request, ["pageSize"]),
  };
}

export const notificationOpsController = {
  async getRules(request: AuthenticatedRequest, response: Response) {
    const result = await notificationOpsService.listRules(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updateRule(request: AuthenticatedRequest, response: Response) {
    const ruleId = readParam(request, "ruleId");

    if (!ruleId) {
      response.status(400).json({
        message: "A notification rule identifier is required.",
      });
      return;
    }

    const result = await notificationOpsService.updateRule(
      request.auth,
      ruleId,
      request.body as UpdateNotificationRuleRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getPolicies(request: AuthenticatedRequest, response: Response) {
    const result = await notificationOpsService.listPolicies(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async updatePolicy(request: AuthenticatedRequest, response: Response) {
    const policyId = readParam(request, "policyId");

    if (!policyId) {
      response.status(400).json({
        message: "A notification policy identifier is required.",
      });
      return;
    }

    const result = await notificationOpsService.updatePolicy(
      request.auth,
      policyId,
      request.body as UpdateNotificationPolicyRequest,
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getDeliveryLogs(request: AuthenticatedRequest, response: Response) {
    const result = await notificationOpsService.listDeliveryLogs(
      request.auth,
      readDeliveryLogFilters(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getFailedLogs(request: AuthenticatedRequest, response: Response) {
    const result = await notificationOpsService.listFailedLogs(
      request.auth,
      readDeliveryLogFilters(request),
    );

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async retryDelivery(request: AuthenticatedRequest, response: Response) {
    const logId = readParam(request, "logId");

    if (!logId) {
      response.status(400).json({
        message: "A notification delivery log identifier is required.",
      });
      return;
    }

    const result = await notificationOpsService.retryDelivery(request.auth, logId);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },

  async getHealth(request: AuthenticatedRequest, response: Response) {
    const result = await notificationOpsService.getHealth(request.auth);

    if (!result.ok) {
      response.status(result.status).json({
        message: result.message,
      });
      return;
    }

    response.status(200).json(result.data);
  },
};
