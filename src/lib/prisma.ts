import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { config } from "./config.js";

// ONE client for the full application. One client = one connection pool.
// Each file imports this one. No other file calls "new PrismaClient()".
const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  // Development: show each SQL query. Other environments: only problems.
  log: config.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
});
