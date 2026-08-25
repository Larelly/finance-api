import type { FastifyInstance } from "fastify";
import { prisma } from "../../shared/db/client.js";
import { requireAuth } from "../../shared/http/auth-middleware.js";
import { createCategoryRepository } from "./repository.js";
import { createCategoryService } from "./service.js";
import { categoryIdParamsSchema, createCategorySchema, updateCategorySchema } from "./schemas.js";

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  const service = createCategoryService(createCategoryRepository(prisma));

  app.get("/", async (request) => {
    return service.list(request.userId);
  });

  app.post("/", async (request, reply) => {
    const input = createCategorySchema.parse(request.body);
    const category = await service.create(request.userId, input);
    reply.status(201).send(category);
  });

  app.patch("/:id", async (request) => {
    const { id } = categoryIdParamsSchema.parse(request.params);
    const input = updateCategorySchema.parse(request.body);
    return service.update(request.userId, id, input);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = categoryIdParamsSchema.parse(request.params);
    await service.delete(request.userId, id);
    reply.status(204).send();
  });
}
