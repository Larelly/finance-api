import type { FastifyInstance } from "fastify";
import { prisma } from "../../shared/db/client.js";
import { requireAuth } from "../../shared/http/auth-middleware.js";
import { createCategoryRepository } from "../categories/repository.js";
import { createTransactionRepository } from "./repository.js";
import { createTransactionService } from "./service.js";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionIdParamsSchema,
  updateTransactionSchema,
} from "./schemas.js";

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  const service = createTransactionService(
    createTransactionRepository(prisma),
    createCategoryRepository(prisma),
  );

  app.get("/", async (request) => {
    const query = listTransactionsQuerySchema.parse(request.query);
    return service.list(request.userId, query);
  });

  app.post("/", async (request, reply) => {
    const input = createTransactionSchema.parse(request.body);
    const transaction = await service.create(request.userId, input);
    reply.status(201).send(transaction);
  });

  app.get("/:id", async (request) => {
    const { id } = transactionIdParamsSchema.parse(request.params);
    return service.getById(request.userId, id);
  });

  app.patch("/:id", async (request) => {
    const { id } = transactionIdParamsSchema.parse(request.params);
    const input = updateTransactionSchema.parse(request.body);
    return service.update(request.userId, id, input);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = transactionIdParamsSchema.parse(request.params);
    await service.delete(request.userId, id);
    reply.status(204).send();
  });
}
