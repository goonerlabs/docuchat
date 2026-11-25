import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

// 401 = we do not know who you are. 403 = we know you, but you do not have permission.
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "NOT_AUTHENTICATED", "Not authenticated");
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
    next();
  };
}
