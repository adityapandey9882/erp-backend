import type { NextFunction, Request, Response } from "express";
import { authService } from "../../modules/auth/auth.service.js";
import type { AuthenticatedRequest } from "../../modules/auth/auth.types.js";

function readBearerToken(request: Request) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function authMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = readBearerToken(request);

  if (!token) {
    response.status(401).json({
      message: "Missing bearer token.",
    });
    return;
  }

  const authenticatedUser = await authService.verifySession(token);

  if (!authenticatedUser) {
    response.status(401).json({
      message: "Invalid or expired access token.",
    });
    return;
  }

  (request as AuthenticatedRequest).auth = authenticatedUser;
  next();
}
