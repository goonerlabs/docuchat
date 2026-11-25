import { prisma } from "../lib/prisma.js";

type NewToken = { userId: string; token: string; expiresAt: Date; deviceInfo?: string };

// "token" is always the SHA-256 hash of the refresh token, never the token itself.
export const refreshTokenRepository = {
  async create(data: NewToken) {
    return prisma.refreshToken.create({ data });
  },

  async findByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { token: tokenHash } });
  },

  // Rotation: delete the old token and store the new one, in ONE transaction.
  // Returns false if the old token is not there (a second request used it first).
  async rotate(oldHash: string, next: NewToken): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const removed = await tx.refreshToken.deleteMany({ where: { token: oldHash } });
      if (removed.count !== 1) return false;
      await tx.refreshToken.create({ data: next });
      return true;
    });
  },

  // deleteMany gives no error if the token is not there.
  async deleteByHash(tokenHash: string) {
    return prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
  },

  async deleteAllForUser(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  },
};
