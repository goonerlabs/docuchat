import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "./config.js";

export interface TokenPayload {
  sub: string; // User ID
  role: string; // "user" or "admin"
  tier: string; // "free", "pro" or "enterprise"
  type: "access" | "refresh";
}

type TokenUser = { id: string; role: string; tier: string };

export function generateAccessToken(user: TokenUser): string {
  return jwt.sign(
    { sub: user.id, role: user.role, tier: user.tier, type: "access" },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"] },
  );
}

export function generateRefreshToken(user: TokenUser): string {
  return jwt.sign(
    { sub: user.id, role: user.role, tier: user.tier, type: "refresh" },
    config.JWT_REFRESH_SECRET,
    {
      expiresIn: config.REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
      // A random ID. Without it, two logins in the same second make the same token,
      // and the second one breaks the unique rule on the stored hash.
      jwtid: crypto.randomUUID(),
    },
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
}

// We store this hash, never the token. A copy of the database gives an attacker no usable token.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// The time when a token stops (from its "exp" claim).
export function tokenExpiry(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) throw new Error("The token has no exp claim");
  return new Date(decoded.exp * 1000);
}
