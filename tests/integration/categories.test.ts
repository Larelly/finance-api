import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import {
  buildTestApp,
  cleanDatabase,
  disconnectDatabase,
  setupTestDatabase,
  teardownTestDatabase,
} from "./helpers/testApp.js";
import { createCategory, registerAndLogin } from "./helpers/fixtures.js";

describe("categories", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await buildTestApp();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
    await teardownTestDatabase();
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("creates and lists categories for the authenticated user", async () => {
    const { accessToken } = await registerAndLogin(app);
    await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });
    await createCategory(app, accessToken, { name: "Salário", type: "INCOME" });

    const response = await request(app.server)
      .get("/api/v1/categories")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it("rejects a duplicate name+type combination with 409", async () => {
    const { accessToken } = await registerAndLogin(app);
    await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    const response = await request(app.server)
      .post("/api/v1/categories")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ name: "Mercado", type: "EXPENSE" });

    expect(response.status).toBe(409);
  });

  it("renames a category", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    const response = await request(app.server)
      .patch(`/api/v1/categories/${category.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ name: "Supermercado" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Supermercado");
  });

  it("rejects renaming a category to a name+type that collides with another category", async () => {
    const { accessToken } = await registerAndLogin(app);
    await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });
    const transporte = await createCategory(app, accessToken, { name: "Transporte", type: "EXPENSE" });

    const response = await request(app.server)
      .patch(`/api/v1/categories/${transporte.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ name: "Mercado" });

    expect(response.status).toBe(409);
  });

  it("deletes a category that has no linked transactions", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    const response = await request(app.server)
      .delete(`/api/v1/categories/${category.id}`)
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(204);
  });

  it("returns 404 when updating or deleting a category that does not exist", async () => {
    const { accessToken } = await registerAndLogin(app);
    const missingId = "00000000-0000-0000-0000-000000000000";

    const patchResponse = await request(app.server)
      .patch(`/api/v1/categories/${missingId}`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ name: "Qualquer" });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await request(app.server)
      .delete(`/api/v1/categories/${missingId}`)
      .set("authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(404);
  });

  it("does not let user A see or modify user B's categories", async () => {
    const userA = await registerAndLogin(app);
    const userB = await registerAndLogin(app);
    const categoryOfA = await createCategory(app, userA.accessToken, { name: "Mercado", type: "EXPENSE" });

    const listAsB = await request(app.server)
      .get("/api/v1/categories")
      .set("authorization", `Bearer ${userB.accessToken}`);
    expect(listAsB.body).toHaveLength(0);

    const patchAsB = await request(app.server)
      .patch(`/api/v1/categories/${categoryOfA.id}`)
      .set("authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Hackeado" });
    expect(patchAsB.status).toBe(404);

    const deleteAsB = await request(app.server)
      .delete(`/api/v1/categories/${categoryOfA.id}`)
      .set("authorization", `Bearer ${userB.accessToken}`);
    expect(deleteAsB.status).toBe(404);
  });

  it("returns 409 when deleting a category that has linked transactions", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: category.id,
        type: "EXPENSE",
        amountCents: 5000,
        occurredAt: "2026-08-10T12:00:00.000Z",
      });

    const response = await request(app.server)
      .delete(`/api/v1/categories/${category.id}`)
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);
  });
});
