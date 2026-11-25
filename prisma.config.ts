import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the database URL from this file, not from schema.prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // "prisma generate" needs no database. The fallback keeps it working without a .env file.
    url: process.env.DATABASE_URL ?? "postgresql://docuchat:docuchat@localhost:5442/docuchat",
  },
});
