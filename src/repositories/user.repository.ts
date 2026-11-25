import { prisma } from "../lib/prisma.js";

// Layer 4: the only layer that talks to the database.
// Each function does one database operation. Prisma sends each value as a parameter,
// so a value from a user is never part of the SQL text (no SQL injection).
export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async create(data: { name: string; email: string; passwordHash: string; role?: string }) {
    return prisma.user.create({ data });
  },

  async updateById(id: string, data: Partial<{ name: string; email: string; isActive: boolean }>) {
    return prisma.user.update({ where: { id }, data });
  },

  // Soft delete: the row stays. Queries for active users use "deletedAt IS NULL".
  async softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  // Never returns the password hash.
  async listActive() {
    return prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, email: true, role: true, tier: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },
};
