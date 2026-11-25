import pino from "pino";
import { config } from "./config.js";

const level =
  config.NODE_ENV === "production" ? "info" : config.NODE_ENV === "test" ? "silent" : "debug";

export const logger = pino({
  level,
  // A secret must never be in a log line. These paths are removed if they appear.
  redact: {
    paths: ["password", "passwordHash", "refreshToken", "accessToken", "req.headers.authorization"],
    censor: "[redacted]",
  },
  // Development: coloured text for people. Production: one JSON object for each line, for tools.
  transport:
    config.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
        }
      : undefined,
});
