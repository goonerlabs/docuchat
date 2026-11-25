import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

// Always the first middleware on a protected route.
// After it, req.user is there and each next handler can trust it.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "NO_TOKEN", "No token provided");
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);

    // A refresh token must not open an API route.
    if (payload.type !== "access") {
      throw new AppError(401, "INVALID_TOKEN_TYPE", "Invalid token type");
    }

    req.user = { id: payload.sub, role: payload.role, tier: payload.tier };
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === "TokenExpiredError") {
      throw new AppError(401, "TOKEN_EXPIRED", "Token expired");
    }
    throw new AppError(401, "INVALID_TOKEN", "Invalid token");
  }
}
