import { prisma } from "../lib/prisma.js";

export const conversationRepository = {
  async create(data: { userId: string; title: string }) {
    return prisma.conversation.create({ data });
  },

  async findByUser(userId: string) {
    return prisma.conversation.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  },
};
