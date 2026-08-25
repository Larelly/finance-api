import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../shared/config/env.js";
import { badRequest, conflict, unauthorized } from "../../shared/http/errors.js";
import type { AuthRepository } from "./repository.js";
import type { LoginInput, RegisterInput } from "./schemas.js";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(userId: string): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, options);
}

const TTL_UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!match) return 15 * 60;
  const [, amount, unit] = match as unknown as [string, string, string];
  return Number(amount) * TTL_UNIT_SECONDS[unit]!;
}

export function createAuthService(repo: AuthRepository) {
  async function issueTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = signAccessToken(userId);

    const rawRefreshToken = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await repo.createRefreshToken({
      userId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL) };
  }

  return {
    async register(input: RegisterInput) {
      const existing = await repo.findUserByEmail(input.email);
      if (existing) {
        throw conflict("Já existe uma conta com este e-mail");
      }

      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const user = await repo.createUser({
        email: input.email,
        passwordHash,
        ...(input.timezone ? { timezone: input.timezone } : {}),
      });

      return { id: user.id, email: user.email, timezone: user.timezone, createdAt: user.createdAt };
    },

    async login(input: LoginInput) {
      const user = await repo.findUserByEmail(input.email);
      if (!user) {
        throw unauthorized("E-mail ou senha inválidos");
      }

      const passwordValid = await argon2.verify(user.passwordHash, input.password);
      if (!passwordValid) {
        throw unauthorized("E-mail ou senha inválidos");
      }

      return issueTokenPair(user.id);
    },

    async refresh(refreshToken: string) {
      const tokenHash = hashRefreshToken(refreshToken);
      const stored = await repo.findActiveRefreshTokenByHash(tokenHash);

      if (!stored) {
        throw unauthorized("Refresh token inválido, expirado ou já utilizado");
      }

      if (stored.expiresAt.getTime() < Date.now()) {
        throw unauthorized("Refresh token inválido, expirado ou já utilizado");
      }

      await repo.revokeRefreshTokenById(stored.id);
      return issueTokenPair(stored.userId);
    },

    async logout(refreshToken: string) {
      if (!refreshToken) {
        throw badRequest("refreshToken é obrigatório");
      }
      const tokenHash = hashRefreshToken(refreshToken);
      await repo.revokeRefreshTokenByHash(tokenHash);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
