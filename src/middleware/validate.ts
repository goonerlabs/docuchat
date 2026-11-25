import type { NextFunction, Request, Response } from "express";
import { z, type ZodType } from "zod";

// Checks req.body against a Zod schema before the controller runs.
// The controller then gets clean data (trimmed, lower-case email).
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
