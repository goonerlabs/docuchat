import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { config } from "../src/lib/config.js";
import { prisma } from "../src/lib/prisma.js";
import { hashToken } from "../src/lib/tokens.js";
import { conversationRepository } from "../src/repositories/conversation.repository.js";
import { usageLogRepository } from "../src/repositories/usage-log.repository.js";
import { resetDatabase, waitFor } from "./helpers.js";

const user = { name: "Test User", email: "test@example.com", password: "Test1234!" };

async function registerAndLogin() {
  const reg = await request(app).post("/api/v1/auth/register").send(user);
  const login = await request(app)
    .post("/api/v1/auth/login")
    .set("User-Agent", "vitest")
    .send({ email: user.email, password: user.password });
  return { userId: reg.body.user.id as string, ...login.body } as {
    userId: string;
    accessToken: string;
    refreshToken: string;
  };
}

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("register", () => {
  it("creates a user, stores a bcrypt hash, and returns no hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(user);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: user.email, name: user.name, role: "user", tier: "free" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const row = await prisma.user.findUnique({ where: { email: user.email } });
    expect(row?.passwordHash).not.toBe(user.password);
    expect(row?.passwordHash.startsWith("$2")).toBe(true); // bcrypt
  });

  it("stores the email trimmed and in lower case", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...user, email: "  MiXed@Example.COM " });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("mixed@example.com");
  });

  it("refuses an email that is already registered (409)", async () => {
    await request(app).post("/api/v1/auth/register").send(user);
    const res = await request(app).post("/api/v1/auth/register").send(user);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
  });

  it("refuses bad input (400) with the field errors", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual(["email", "name", "password"]);
  });

  it("runs the listeners: a sign-up log and a welcome conversation", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(user);
    const userId = res.body.user.id as string;

    const logs = await waitFor(() => usageLogRepository.findByUser(userId), (l) => l.length >= 1);
    const conversations = await waitFor(
      () => conversationRepository.findByUser(userId),
      (c) => c.length >= 1,
    );

    expect(logs.map((l) => l.action)).toContain("signup");
    expect(conversations[0]?.title).toBe("Welcome to DocuChat");
  });
});

describe("login", () => {
  it("returns an access token, a refresh token and the user", async () => {
    const session = await registerAndLogin();

    const access = jwt.verify(session.accessToken, config.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    const refresh = jwt.verify(session.refreshToken, config.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    expect(access.type).toBe("access");
    expect(access.sub).toBe(session.userId);
    expect(access.exp! - access.iat!).toBe(15 * 60);
    expect(refresh.type).toBe("refresh");
    expect(refresh.exp! - refresh.iat!).toBe(7 * 24 * 60 * 60);
  });

  it("stores the SHA-256 hash of the refresh token, never the token", async () => {
    const session = await registerAndLogin();
    const rows = await prisma.refreshToken.findMany({ where: { userId: session.userId } });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.token).toBe(hashToken(session.refreshToken));
    expect(rows[0]?.token).not.toBe(session.refreshToken);
    expect(rows[0]?.deviceInfo).toBe("vitest");
  });

  it("gives the same error for an unknown email and for a wrong password", async () => {
    await request(app).post("/api/v1/auth/register").send(user);

    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: user.password });
    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Wrong1234!" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.body.error).toBe("Invalid credentials");
  });

  it("refuses an inactive user", async () => {
    await request(app).post("/api/v1/auth/register").send(user);
    await prisma.user.update({ where: { email: user.email }, data: { isActive: false } });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(401);
  });

  it("lets two logins in the same second each have their own session", async () => {
    await request(app).post("/api/v1/auth/register").send(user);
    const body = { email: user.email, password: user.password };
    const [a, b] = await Promise.all([
      request(app).post("/api/v1/auth/login").send(body),
      request(app).post("/api/v1/auth/login").send(body),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.refreshToken).not.toBe(b.body.refreshToken);
  });

  it("runs the login listener: an audit log with the device", async () => {
    const session = await registerAndLogin();
    const logs = await waitFor(
      () => usageLogRepository.findByUser(session.userId),
      (l) => l.some((x) => x.action === "login"),
    );
    const login = logs.find((l) => l.action === "login");
    expect((login?.metadata as { deviceInfo: string }).deviceInfo).toBe("vitest");
  });
});

describe("protected routes", () => {
  it("opens /users/me with a valid access token", async () => {
    const session = await registerAndLogin();
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("answers 401 with no token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No token provided");
  });

  it("answers 401 'Token expired' for an expired token", async () => {
    const session = await registerAndLogin();
    const expired = jwt.sign(
      { sub: session.userId, role: "user", tier: "free", type: "access" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );
    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token expired");
  });

  it("refuses a refresh token used as an access token", async () => {
    const session = await registerAndLogin();
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.refreshToken}`);
    expect(res.status).toBe(401);
  });

  it("refuses a token with a changed payload", async () => {
    const session = await registerAndLogin();
    const [header, , signature] = session.accessToken.split(".");
    const payload = Buffer.from(
      JSON.stringify({ sub: session.userId, role: "admin", tier: "free", type: "access" }),
    ).toString("base64url");
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${header}.${payload}.${signature}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("answers 403 on an admin route for a normal user, and 200 for an admin", async () => {
    const session = await registerAndLogin();
    const asUser = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(asUser.status).toBe(403);

    await prisma.user.update({ where: { id: session.userId }, data: { role: "admin" } });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password });
    const asAdmin = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.users).toHaveLength(1);
    expect(JSON.stringify(asAdmin.body)).not.toContain("passwordHash");
  });
});

describe("refresh", () => {
  it("rotates: new tokens come back and the old refresh token stops", async () => {
    const session = await registerAndLogin();

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(session.refreshToken);

    const me = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${first.body.accessToken}`);
    expect(me.status).toBe(200);

    const rows = await prisma.refreshToken.findMany({ where: { userId: session.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token).toBe(hashToken(first.body.refreshToken));
  });

  it("ends all sessions of the user when an old refresh token is used again", async () => {
    const session = await registerAndLogin();
    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);

    // The new token from the first refresh is stopped too.
    const afterReuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: first.body.refreshToken });
    expect(afterReuse.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: session.userId } })).toBe(0);
  });

  it("refuses an access token used as a refresh token", async () => {
    const session = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.accessToken });
    expect(res.status).toBe(401);
  });

  it("refuses a refresh token whose database row is expired", async () => {
    const session = await registerAndLogin();
    await prisma.refreshToken.updateMany({
      where: { userId: session.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  it("deletes the refresh token, so no new access token can be made", async () => {
    const session = await registerAndLogin();

    const out = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: session.refreshToken });
    expect(out.status).toBe(200);
    expect(out.body.message).toBe("Logged out");
    expect(await prisma.refreshToken.count({ where: { userId: session.userId } })).toBe(0);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });

  it("gives the same answer when the token is not there", async () => {
    const session = await registerAndLogin();
    await request(app).post("/api/v1/auth/logout").send({ refreshToken: session.refreshToken });
    const again = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: session.refreshToken });
    expect(again.status).toBe(200);
  });
});

describe("the full flow", () => {
  it("register → login → protected route → refresh → logout", async () => {
    const session = await registerAndLogin();
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    expect((await request(app).get("/api/v1/users/me").set(auth(session.accessToken))).status).toBe(200);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect((await request(app).get("/api/v1/users/me").set(auth(refreshed.body.accessToken))).status).toBe(200);

    await request(app).post("/api/v1/auth/logout").send({ refreshToken: refreshed.body.refreshToken });
    const afterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: refreshed.body.refreshToken });
    expect(afterLogout.status).toBe(401);
  });
});
