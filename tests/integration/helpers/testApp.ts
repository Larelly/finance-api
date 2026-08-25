import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { FastifyInstance } from "fastify";

let container: StartedPostgreSqlContainer | undefined;

export async function setupTestDatabase(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("finance_test")
    .withUsername("finance")
    .withPassword("finance")
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_ACCESS_SECRET = "test-access-secret-must-be-32-characters-long";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-must-be-32-characters-long";
  process.env.JWT_ACCESS_TTL = "15m";
  process.env.JWT_REFRESH_TTL_DAYS = "7";
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}

export async function teardownTestDatabase(): Promise<void> {
  await container?.stop();
}

export async function buildTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import("../../../src/app.js");
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function cleanDatabase(): Promise<void> {
  const { prisma } = await import("../../../src/shared/db/client.js");
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDatabase(): Promise<void> {
  const { prisma } = await import("../../../src/shared/db/client.js");
  await prisma.$disconnect();
}
