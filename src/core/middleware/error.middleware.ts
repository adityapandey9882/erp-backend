import type { NextFunction, Request, Response } from "express";

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
        ? error.statusCode
        : error instanceof SyntaxError
          ? 400
          : 500;

  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred.";

  response.status(status).json({ message });
}
