import type { RequestHandler } from "express";
import { appConfig } from "../../config/app.config.js";

const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const allowedHeaders = ["Content-Type", "Authorization"];

export const corsMiddleware: RequestHandler = (request, response, next) => {
  const requestOrigin = request.headers.origin;
  const isAllowedOrigin =
    typeof requestOrigin === "string" &&
    appConfig.cors.allowedOrigins.includes(requestOrigin);

  if (isAllowedOrigin && requestOrigin) {
    response.header("Access-Control-Allow-Origin", requestOrigin);
    response.append("Vary", "Origin");
    response.header("Access-Control-Allow-Methods", allowedMethods.join(", "));
    response.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));

    if (appConfig.cors.allowCredentials) {
      response.header("Access-Control-Allow-Credentials", "true");
    }
  }

  if (request.method === "OPTIONS") {
    if (!requestOrigin || isAllowedOrigin) {
      response.sendStatus(204);
      return;
    }

    response.status(403).json({
      message: "CORS origin is not allowed.",
    });
    return;
  }

  next();
};
