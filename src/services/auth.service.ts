import { AUTH_EVENTS } from "../events/auth.events.js";
import { AppError } from "../lib/errors.js";
import { appEvents } from "../lib/events.js";
import { logger } from "../lib/logger.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  tokenExpiry,
  verifyRefreshToken,
  type TokenPayload,
} from "../lib/tokens.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { userRepository } from "../repositories/user.repository.js";

// Layer 3: business logic. No req, no res, no Prisma here.
// Input is plain data. Output is plain data. Database work goes through the repositories.

type PublicUser = { id: string; name: string; email: string; role: string; tier: string };

function toPublicUser(user: PublicUser): PublicUser {
  // The password hash never leaves the service.
  return { id: user.id, name: user.name, email: user.email, role: user.role, tier: user.tier };
}

// One message for an unknown email and for a wrong password.
// Two messages would tell an attacker which emails have an account.
const invalidCredentials = () => new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

async function issueTokens(user: PublicUser, deviceInfo?: string) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  return {
    accessToken,
    refreshToken,
    stored: {
      userId: user.id,
      token: hashToken(refreshToken),
      expiresAt: tokenExpiry(refreshToken),
      deviceInfo,
    },
  };
}

export async function register(data: { name: string; email: string; password: string }) {
  const existing = await userRepository.findByEmail(data.email);
  if (existing) {
    throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  }

  const passwordHash = await hashPassword(data.password);
  const user = await userRepository.create({ name: data.name, email: data.email, passwordHash });

  // Emit and continue. The listeners do the side effects; register() does not wait for them.
  appEvents.emit(AUTH_EVENTS.USER_REGISTERED, { id: user.id, email: user.email, tier: user.tier });

  return toPublicUser(user);
}

export async function login(data: { email: string; password: string; deviceInfo?: string }) {
  const user = await userRepository.findByEmail(data.email);

  if (!user || !user.isActive || user.deletedAt) {
    // Do the same slow work as for a real user, so the response time is the same.
    await verifyPassword(data.password, DUMMY_HASH);
    appEvents.emit(AUTH_EVENTS.LOGIN_FAILED, {
      email: data.email,
      deviceInfo: data.deviceInfo,
      reason: "user_not_found",
    });
    throw invalidCredentials();
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    appEvents.emit(AUTH_EVENTS.LOGIN_FAILED, {
      email: data.email,
      deviceInfo: data.deviceInfo,
      reason: "wrong_password",
    });
    throw invalidCredentials();
  }

  const { accessToken, refreshToken, stored } = await issueTokens(user, data.deviceInfo);
  await refreshTokenRepository.create(stored);

  appEvents.emit(AUTH_EVENTS.USER_LOGGED_IN, { userId: user.id, deviceInfo: data.deviceInfo });

  return { accessToken, refreshToken, user: toPublicUser(user) };
}

export async function refresh(rawRefreshToken: string, deviceInfo?: string) {
  // 1. The signature and the expiry time.
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }
  if (payload.type !== "refresh") {
    throw new AppError(401, "INVALID_TOKEN_TYPE", "Invalid token type");
  }

  // 2. Is the token in the database? If not, it is revoked or used before.
  const oldHash = hashToken(rawRefreshToken);
  const stored = await refreshTokenRepository.findByHash(oldHash);
  if (!stored) {
    // A correctly signed token that we do not have: a thief or the real user used it before.
    // We cannot tell who, so we end all sessions of this user. The real user logs in again.
    await refreshTokenRepository.deleteAllForUser(payload.sub);
    logger.warn({ event: "auth:refresh-token-reuse", userId: payload.sub });
    throw new AppError(401, "REFRESH_TOKEN_REVOKED", "Refresh token expired or revoked");
  }
  if (stored.expiresAt < new Date()) {
    await refreshTokenRepository.deleteByHash(oldHash);
    throw new AppError(401, "REFRESH_TOKEN_REVOKED", "Refresh token expired or revoked");
  }

  // 3. The user. Role and tier come from the database, not from the old token.
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive || user.deletedAt) {
    await refreshTokenRepository.deleteAllForUser(payload.sub);
    throw new AppError(401, "USER_INACTIVE", "User not found or inactive");
  }

  // 4. Rotation: the old token stops, a new one starts.
  const next = await issueTokens(user, deviceInfo ?? stored.deviceInfo ?? undefined);
  const rotated = await refreshTokenRepository.rotate(oldHash, next.stored);
  if (!rotated) {
    throw new AppError(401, "REFRESH_TOKEN_REVOKED", "Refresh token expired or revoked");
  }

  appEvents.emit(AUTH_EVENTS.TOKEN_REFRESHED, { userId: user.id });

  return { accessToken: next.accessToken, refreshToken: next.refreshToken };
}

export async function logout(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await refreshTokenRepository.findByHash(tokenHash);
  // No error if the token is not there: logout gives the same answer each time.
  await refreshTokenRepository.deleteByHash(tokenHash);
  appEvents.emit(AUTH_EVENTS.USER_LOGGED_OUT, { userId: stored?.userId });
}
