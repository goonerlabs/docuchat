import cors from "cors";
import express from "express";
import helmet from "helmet";

// This import runs the file, and the file registers the listeners on appEvents.
import "./events/auth.events.js";

import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";

const app = express();

// === MIDDLEWARE (runs on each request). The order is important. ===
app.use(helmet()); // Security headers
app.use(cors()); // Cross-origin requests
app.use(express.json({ limit: "100kb" })); // Parse JSON request bodies

// === REQUEST LOGGING (before the routes, so each request is in the log) ===
app.use((req, _res, next) => {
  logger.info({ event: "http:request", method: req.method, url: req.url, ip: req.ip });
  next();
});

// === HEALTH CHECK (public) ===
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), environment: config.NODE_ENV });
});

// === ROUTES ===
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// === ERROR HANDLER (must be the last middleware) ===
app.use(errorHandler);

export { app };
