import type { FastifyInstance } from "fastify";
import { prisma } from "../../shared/db/client.js";
import { requireAuth } from "../../shared/http/auth-middleware.js";
import { createReportRepository } from "./repository.js";
import { createReportService } from "./service.js";
import { monthlyReportQuerySchema } from "./schemas.js";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  const service = createReportService(createReportRepository(prisma));

  app.get("/monthly", async (request) => {
    const query = monthlyReportQuerySchema.parse(request.query);
    return service.monthly(request.userId, query);
  });
}
