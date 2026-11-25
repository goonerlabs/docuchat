import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export const usageLogRepository = {
  async create(data: {
    userId: string;
    action: string;
    tokens?: number;
    costUsd?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.usageLog.create({ data });
  },

  async findByUser(userId: string) {
    return prisma.usageLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  },
};
