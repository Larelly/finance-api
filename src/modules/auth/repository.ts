import type { PrismaClient } from "@prisma/client";

export function createAuthRepository(db: PrismaClient) {
  return {
    findUserByEmail(email: string) {
      return db.user.findUnique({ where: { email } });
    },

    findUserById(id: string) {
      return db.user.findUnique({ where: { id } });
    },

    createUser(data: { email: string; passwordHash: string; timezone?: string }) {
      return db.user.create({ data });
    },

    createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
      return db.refreshToken.create({ data });
    },

    findActiveRefreshTokenByHash(tokenHash: string) {
      return db.refreshToken.findFirst({
        where: { tokenHash, revokedAt: null },
      });
    },

    revokeRefreshTokenById(id: string) {
      return db.refreshToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    },

    revokeRefreshTokenByHash(tokenHash: string) {
      return db.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
