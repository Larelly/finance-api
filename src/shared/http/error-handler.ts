import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ProblemError } from "./errors.js";

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: unknown;
}

function send(reply: FastifyReply, request: FastifyRequest, problem: ProblemDetails) {
  reply
    .status(problem.status)
    .header("content-type", "application/problem+json")
    .send(problem);
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | ProblemError | ZodError, request, reply) => {
    if (error instanceof ProblemError) {
      send(reply, request, {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
        instance: request.url,
        ...(error.extras ?? {}),
      });
      return;
    }

    if (error instanceof ZodError) {
      send(reply, request, {
        type: "https://finance-api.dev/problems/validation-error",
        title: "Validation Error",
        status: 400,
        detail: "Um ou mais campos são inválidos",
        instance: request.url,
        errors: error.flatten().fieldErrors,
      });
      return;
    }

    // Fastify's own payload/schema validation errors
    if (typeof error.statusCode === "number" && error.statusCode < 500) {
      send(reply, request, {
        type: "https://finance-api.dev/problems/bad-request",
        title: "Bad Request",
        status: error.statusCode,
        detail: error.message,
        instance: request.url,
      });
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    send(reply, request, {
      type: "https://finance-api.dev/problems/internal-server-error",
      title: "Internal Server Error",
      status: 500,
      detail: "Ocorreu um erro inesperado",
      instance: request.url,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    send(reply, request, {
      type: "https://finance-api.dev/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: `Rota ${request.method} ${request.url} não existe`,
      instance: request.url,
    });
  });
}
