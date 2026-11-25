import "dotenv/config";
import { z } from "zod";

// Each environment variable that the application needs.
// process.env values are always strings and can be missing, so we check them at the start.
const envSchema = z
  .object({
    // Server
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Authentication: two different secrets (lesson 3.1).
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

    // OpenAI (necessary from week 4)
    OPENAI_API_KEY: z.string().optional(),

    // Redis (necessary from week 3)
    REDIS_URL: z.string().optional(),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    // With the same secret, a refresh token could pass as an access token.
    message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different",
    path: ["JWT_REFRESH_SECRET"],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // The logger needs the config, so this one message uses console.error.
  console.error("\nInvalid environment variables:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1); // Stop now. A running application with a bad config is worse than a stopped one.
}

export const config = parsed.data;
