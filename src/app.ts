import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./shared/config/env.js";
import { registerErrorHandler } from "./shared/http/error-handler.js";
import { buildOpenApiDocument } from "./shared/http/openapi.js";
import { prisma } from "./shared/db/client.js";
import { authRoutes } from "./modules/auth/routes.js";
import { categoryRoutes } from "./modules/categories/routes.js";
import { transactionRoutes } from "./modules/transactions/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  await app.register(cors, { origin: true });

  await app.register(swagger, {
    mode: "static",
    // The document is hand-assembled from Zod schemas (see openapi.ts); its shape is
    // valid OpenAPI 3.1 but doesn't structurally match @fastify/swagger's OpenAPI 3.0 types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    specification: { document: buildOpenApiDocument() as any },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  registerErrorHandler(app);

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "Database readiness check failed");
      reply.status(503);
      return { status: "unavailable" };
    }
  });

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(categoryRoutes, { prefix: "/api/v1/categories" });
  await app.register(transactionRoutes, { prefix: "/api/v1/transactions" });
  await app.register(reportRoutes, { prefix: "/api/v1/reports" });

  return app;
}
