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

describe("transactions", () => {
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

  it("creates a transaction and returns amountCents as a JSON number, not a string", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    const response = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: category.id,
        type: "EXPENSE",
        amountCents: 187_600,
        occurredAt: "2026-08-10T12:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.amountCents).toBe(187_600);
    expect(typeof response.body.amountCents).toBe("number");
  });

  it("rejects amountCents zero or negative with 400", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken);

    const zero = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.id, type: "EXPENSE", amountCents: 0, occurredAt: "2026-08-10T12:00:00Z" });
    expect(zero.status).toBe(400);

    const negative = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.id, type: "EXPENSE", amountCents: -100, occurredAt: "2026-08-10T12:00:00Z" });
    expect(negative.status).toBe(400);
  });

  it("rejects a transaction whose type diverges from its category's type with 400", async () => {
    const { accessToken } = await registerAndLogin(app);
    const expenseCategory = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    const response = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: expenseCategory.id,
        type: "INCOME",
        amountCents: 1000,
        occurredAt: "2026-08-10T12:00:00Z",
      });

    expect(response.status).toBe(400);
  });

  it("caps pageSize at 100 instead of accepting an arbitrary value", async () => {
    const { accessToken } = await registerAndLogin(app);

    const response = await request(app.server)
      .get("/api/v1/transactions?pageSize=500")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(100);
  });

  it("soft-deletes a transaction: it disappears from listing but stays readable directly", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken);

    const created = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: category.id,
        type: "EXPENSE",
        amountCents: 1000,
        occurredAt: "2026-08-10T12:00:00Z",
      });

    const deleteResponse = await request(app.server)
      .delete(`/api/v1/transactions/${created.body.id}`)
      .set("authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(204);

    const listResponse = await request(app.server)
      .get("/api/v1/transactions")
      .set("authorization", `Bearer ${accessToken}`);
    expect(listResponse.body.data).toHaveLength(0);

    const getDeletedResponse = await request(app.server)
      .get(`/api/v1/transactions/${created.body.id}`)
      .set("authorization", `Bearer ${accessToken}`);
    expect(getDeletedResponse.status).toBe(404);
  });

  it("does not let user A see or delete user B's transactions", async () => {
    const userA = await registerAndLogin(app);
    const userB = await registerAndLogin(app);
    const categoryOfA = await createCategory(app, userA.accessToken);

    const created = await request(app.server)
      .post("/api/v1/transactions")
      .set("authorization", `Bearer ${userA.accessToken}`)
      .send({
        categoryId: categoryOfA.id,
        type: "EXPENSE",
        amountCents: 1000,
        occurredAt: "2026-08-10T12:00:00Z",
      });

    const getAsB = await request(app.server)
      .get(`/api/v1/transactions/${created.body.id}`)
      .set("authorization", `Bearer ${userB.accessToken}`);
    expect(getAsB.status).toBe(404);

    const listAsB = await request(app.server)
      .get("/api/v1/transactions")
      .set("authorization", `Bearer ${userB.accessToken}`);
    expect(listAsB.body.data).toHaveLength(0);

    const deleteAsB = await request(app.server)
      .delete(`/api/v1/transactions/${created.body.id}`)
      .set("authorization", `Bearer ${userB.accessToken}`);
    expect(deleteAsB.status).toBe(404);
  });
});
