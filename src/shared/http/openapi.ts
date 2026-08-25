import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from "../../modules/auth/schemas.js";
import { createCategorySchema, updateCategorySchema } from "../../modules/categories/schemas.js";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from "../../modules/transactions/schemas.js";
import { monthlyReportQuerySchema } from "../../modules/reports/schemas.js";

function toSchema(schema: ZodTypeAny) {
  return zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none" });
}

const problemDetails = {
  type: "object",
  properties: {
    type: { type: "string" },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
    instance: { type: "string" },
  },
};

const bearerAuth = [{ bearerAuth: [] as string[] }];

function jsonBody(schema: ZodTypeAny) {
  return { required: true, content: { "application/json": { schema: toSchema(schema) } } };
}

function jsonResponse(schema: ZodTypeAny | Record<string, unknown>, description = "OK") {
  const jsonSchema = "safeParse" in (schema as object) ? toSchema(schema as ZodTypeAny) : schema;
  return { description, content: { "application/json": { schema: jsonSchema } } };
}

const problemResponse = (description: string) => jsonResponse(problemDetails, description);

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Finance API",
      description: "API REST de finanças pessoais — dinheiro em centavos, datas em intervalo semiaberto.",
      version: "1.0.0",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    tags: [
      { name: "auth" },
      { name: "categories" },
      { name: "transactions" },
      { name: "reports" },
      { name: "operational" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["operational"],
          summary: "Liveness probe",
          responses: { "200": jsonResponse({ type: "object" }) },
        },
      },
      "/ready": {
        get: {
          tags: ["operational"],
          summary: "Readiness probe (checks database connectivity)",
          responses: {
            "200": jsonResponse({ type: "object" }),
            "503": jsonResponse({ type: "object" }, "Database unavailable"),
          },
        },
      },
      "/api/v1/auth/register": {
        post: {
          tags: ["auth"],
          summary: "Register a new user",
          requestBody: jsonBody(registerSchema),
          responses: { "201": jsonResponse({ type: "object" }), "409": problemResponse("Email already in use") },
        },
      },
      "/api/v1/auth/login": {
        post: {
          tags: ["auth"],
          summary: "Log in and receive an access + refresh token pair",
          requestBody: jsonBody(loginSchema),
          responses: { "200": jsonResponse({ type: "object" }), "401": problemResponse("Invalid credentials") },
        },
      },
      "/api/v1/auth/refresh": {
        post: {
          tags: ["auth"],
          summary: "Rotate a refresh token for a new access + refresh pair",
          requestBody: jsonBody(refreshSchema),
          responses: {
            "200": jsonResponse({ type: "object" }),
            "401": problemResponse("Invalid, expired or already-used refresh token"),
          },
        },
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["auth"],
          summary: "Revoke a refresh token",
          requestBody: jsonBody(logoutSchema),
          responses: { "204": { description: "No Content" } },
        },
      },
      "/api/v1/categories": {
        get: {
          tags: ["categories"],
          security: bearerAuth,
          summary: "List the authenticated user's categories",
          responses: { "200": jsonResponse({ type: "array" }) },
        },
        post: {
          tags: ["categories"],
          security: bearerAuth,
          summary: "Create a category",
          requestBody: jsonBody(createCategorySchema),
          responses: { "201": jsonResponse({ type: "object" }), "409": problemResponse("Duplicate name+type") },
        },
      },
      "/api/v1/categories/{id}": {
        patch: {
          tags: ["categories"],
          security: bearerAuth,
          summary: "Update a category",
          requestBody: jsonBody(updateCategorySchema),
          responses: { "200": jsonResponse({ type: "object" }), "404": problemResponse("Not found") },
        },
        delete: {
          tags: ["categories"],
          security: bearerAuth,
          summary: "Delete a category (409 if it has linked transactions)",
          responses: { "204": { description: "No Content" }, "409": problemResponse("Has linked transactions") },
        },
      },
      "/api/v1/transactions": {
        get: {
          tags: ["transactions"],
          security: bearerAuth,
          summary: "List transactions with pagination, filters and sorting",
          parameters: Object.entries((toSchema(listTransactionsQuerySchema) as { properties?: Record<string, unknown> }).properties ?? {}).map(
            ([name, schema]) => ({ name, in: "query", schema }),
          ),
          responses: { "200": jsonResponse({ type: "object" }) },
        },
        post: {
          tags: ["transactions"],
          security: bearerAuth,
          summary: "Create a transaction",
          requestBody: jsonBody(createTransactionSchema),
          responses: { "201": jsonResponse({ type: "object" }), "400": problemResponse("Validation error") },
        },
      },
      "/api/v1/transactions/{id}": {
        get: {
          tags: ["transactions"],
          security: bearerAuth,
          summary: "Get a transaction by id",
          responses: { "200": jsonResponse({ type: "object" }), "404": problemResponse("Not found") },
        },
        patch: {
          tags: ["transactions"],
          security: bearerAuth,
          summary: "Update a transaction",
          requestBody: jsonBody(updateTransactionSchema),
          responses: { "200": jsonResponse({ type: "object" }), "404": problemResponse("Not found") },
        },
        delete: {
          tags: ["transactions"],
          security: bearerAuth,
          summary: "Soft-delete a transaction",
          responses: { "204": { description: "No Content" } },
        },
      },
      "/api/v1/reports/monthly": {
        get: {
          tags: ["reports"],
          security: bearerAuth,
          summary: "Monthly report: totals, breakdown by category, comparison with previous month",
          parameters: Object.entries((toSchema(monthlyReportQuerySchema) as { properties?: Record<string, unknown> }).properties ?? {}).map(
            ([name, schema]) => ({ name, in: "query", schema }),
          ),
          responses: { "200": jsonResponse({ type: "object" }), "400": problemResponse("Invalid month/timezone") },
        },
      },
    },
  };
}
