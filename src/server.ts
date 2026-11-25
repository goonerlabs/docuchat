import { app } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

// app.ts makes the application. This file starts it on a port.
// The tests import "app" and need no port.
const server = app.listen(config.PORT, () => {
  logger.info({ event: "server:started", port: config.PORT, environment: config.NODE_ENV });
});

// Stop cleanly: complete the open requests, then close the database pool.
function shutdown(signal: string) {
  logger.info({ event: "server:stopping", signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
