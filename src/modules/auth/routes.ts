import type { FastifyInstance } from "fastify";
import { prisma } from "../../shared/db/client.js";
import { createAuthRepository } from "./repository.js";
import { createAuthService } from "./service.js";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./schemas.js";

export async function authRoutes(app: FastifyInstance) {
  const service = createAuthService(createAuthRepository(prisma));

  app.post("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await service.register(input);
    reply.status(201).send(user);
  });

  app.post("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const tokens = await service.login(input);
    reply.status(200).send(tokens);
  });

  app.post("/refresh", async (request, reply) => {
    const input = refreshSchema.parse(request.body);
    const tokens = await service.refresh(input.refreshToken);
    reply.status(200).send(tokens);
  });

  app.post("/logout", async (request, reply) => {
    const input = logoutSchema.parse(request.body);
    await service.logout(input.refreshToken);
    reply.status(204).send();
  });
}
