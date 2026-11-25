import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /health", () => {
  it("answers with the status, the time and the environment, with no token", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.environment).toBe("test");
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it("answers 404 with JSON for an unknown route", async () => {
    const res = await request(app).get("/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
