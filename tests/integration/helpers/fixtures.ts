import type { FastifyInstance } from "fastify";
import request from "supertest";

let counter = 0;

export function uniqueEmail(): string {
  counter += 1;
  return `user${counter}-${Date.now()}@example.com`;
}

export async function registerAndLogin(
  app: FastifyInstance,
  overrides: { email?: string; password?: string; timezone?: string } = {},
): Promise<{ userId: string; accessToken: string; refreshToken: string; email: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "super-secret-password";

  const registerResponse = await request(app.server)
    .post("/api/v1/auth/register")
    .send({ email, password, ...(overrides.timezone ? { timezone: overrides.timezone } : {}) });

  const userId = registerResponse.body.id as string;

  const loginResponse = await request(app.server).post("/api/v1/auth/login").send({ email, password });

  const { accessToken, refreshToken } = loginResponse.body as {
    accessToken: string;
    refreshToken: string;
  };

  return { userId, accessToken, refreshToken, email };
}

export async function createCategory(
  app: FastifyInstance,
  accessToken: string,
  overrides: { name?: string; type?: "INCOME" | "EXPENSE" } = {},
): Promise<{ id: string; name: string; type: "INCOME" | "EXPENSE" }> {
  const response = await request(app.server)
    .post("/api/v1/categories")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ name: overrides.name ?? "Mercado", type: overrides.type ?? "EXPENSE" });

  return response.body;
}
