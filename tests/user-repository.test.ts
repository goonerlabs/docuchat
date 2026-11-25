import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { userRepository } from "../src/repositories/user.repository.js";
import { resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("userRepository", () => {
  it("creates a user with the default values and finds it by email and by ID", async () => {
    const created = await userRepository.create({
      name: "Ada",
      email: "ada@example.com",
      passwordHash: "not-a-real-hash",
    });

    expect(created.role).toBe("user");
    expect(created.tier).toBe("free");
    expect(created.isActive).toBe(true);
    expect(created.deletedAt).toBeNull();

    const byEmail = await userRepository.findByEmail("ada@example.com");
    const byId = await userRepository.findById(created.id);
    expect(byEmail?.id).toBe(created.id);
    expect(byId?.email).toBe("ada@example.com");
  });

  it("refuses a second user with the same email (the unique constraint)", async () => {
    await userRepository.create({ name: "A", email: "same@example.com", passwordHash: "x" });
    await expect(
      userRepository.create({ name: "B", email: "same@example.com", passwordHash: "y" }),
    ).rejects.toThrow();
  });

  it("treats SQL in the input as plain data (no SQL injection)", async () => {
    await userRepository.create({ name: "A", email: "a@example.com", passwordHash: "x" });
    const found = await userRepository.findByEmail("' OR '1'='1");
    expect(found).toBeNull();
    expect(await prisma.user.count()).toBe(1);
  });

  it("soft delete keeps the row and sets deletedAt", async () => {
    const user = await userRepository.create({ name: "A", email: "a@example.com", passwordHash: "x" });
    await userRepository.softDelete(user.id);

    const row = await userRepository.findById(user.id);
    expect(row).not.toBeNull();
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(await userRepository.listActive()).toHaveLength(0);
  });
});
