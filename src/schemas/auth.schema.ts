import { z } from "zod";

// One email is one account: "John@Test.com " and "john@test.com" are the same.
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  // bcrypt uses only the first 72 bytes of a password, so longer ones are refused.
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
