import { appEvents } from "../lib/events.js";
import { logger } from "../lib/logger.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { usageLogRepository } from "../repositories/usage-log.repository.js";

export const AUTH_EVENTS = {
  USER_REGISTERED: "auth:user-registered",
  USER_LOGGED_IN: "auth:user-logged-in",
  USER_LOGGED_OUT: "auth:user-logged-out",
  TOKEN_REFRESHED: "auth:token-refreshed",
  LOGIN_FAILED: "auth:login-failed",
} as const;

export interface UserRegisteredEvent {
  id: string;
  email: string;
  tier: string;
}
export interface UserLoggedInEvent {
  userId: string;
  deviceInfo?: string;
}
export interface LoginFailedEvent {
  email: string;
  deviceInfo?: string;
  reason: "user_not_found" | "wrong_password";
}

// A listener is a side effect. It must NEVER stop the main operation.
// An error that leaves a listener can stop the Node process, so each listener goes through this wrapper.
function safeListener<T>(name: string, work: (payload: T) => Promise<void> | void) {
  return async (payload: T) => {
    try {
      await work(payload);
    } catch (err) {
      logger.error({ event: "listener:failed", listener: name, err });
    }
  };
}

// Listener 1: record the sign-up for analytics.
appEvents.on(
  AUTH_EVENTS.USER_REGISTERED,
  safeListener<UserRegisteredEvent>("signup-usage-log", async (user) => {
    await usageLogRepository.create({
      userId: user.id,
      action: "signup",
      metadata: { tier: user.tier, registeredAt: new Date().toISOString() },
    });
  }),
);

// Listener 2: make the first conversation.
appEvents.on(
  AUTH_EVENTS.USER_REGISTERED,
  safeListener<UserRegisteredEvent>("welcome-conversation", async (user) => {
    await conversationRepository.create({ userId: user.id, title: "Welcome to DocuChat" });
  }),
);

// Listener 3: record each login (useful for a security audit).
appEvents.on(
  AUTH_EVENTS.USER_LOGGED_IN,
  safeListener<UserLoggedInEvent>("login-usage-log", async (data) => {
    await usageLogRepository.create({
      userId: data.userId,
      action: "login",
      metadata: { deviceInfo: data.deviceInfo ?? null, loginAt: new Date().toISOString() },
    });
  }),
);

// Listener 4: a warning for each failed login. Week 3 adds a rate limit here, with no change to login().
appEvents.on(
  AUTH_EVENTS.LOGIN_FAILED,
  safeListener<LoginFailedEvent>("login-failed-warning", (data) => {
    logger.warn({
      event: AUTH_EVENTS.LOGIN_FAILED,
      email: data.email,
      deviceInfo: data.deviceInfo,
      reason: data.reason,
    });
  }),
);

appEvents.on(
  AUTH_EVENTS.TOKEN_REFRESHED,
  safeListener<{ userId: string }>("token-refreshed-log", (data) => {
    logger.debug({ event: AUTH_EVENTS.TOKEN_REFRESHED, userId: data.userId });
  }),
);

appEvents.on(
  AUTH_EVENTS.USER_LOGGED_OUT,
  safeListener<{ userId?: string }>("logout-log", (data) => {
    logger.info({ event: AUTH_EVENTS.USER_LOGGED_OUT, userId: data.userId });
  }),
);
