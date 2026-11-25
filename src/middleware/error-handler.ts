import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

// The last middleware in app.ts: it catches each error from the code before it.
// Express knows an error handler by its four parameters.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // A JSON body that is not correct JSON.
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body", code: "INVALID_JSON" });
    return;
  }

  // An error that we did not expect: log all of it, tell the client nothing about the inside.
  logger.error({ event: "http:unhandled-error", method: req.method, url: req.url, err });
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
