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

async function createTransaction(
  app: FastifyInstance,
  accessToken: string,
  payload: { categoryId: string; type: "INCOME" | "EXPENSE"; amountCents: number; occurredAt: string },
) {
  return request(app.server)
    .post("/api/v1/transactions")
    .set("authorization", `Bearer ${accessToken}`)
    .send(payload);
}

describe("reports/monthly", () => {
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

  it("THE central test: a transaction at 2026-09-01T02:30Z with timezone=America/Sao_Paulo appears in the August report", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });

    await createTransaction(app, accessToken, {
      categoryId: category.id,
      type: "EXPENSE",
      amountCents: 5000,
      occurredAt: "2026-09-01T02:30:00.000Z",
    });

    const augustReport = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(augustReport.body.totals.expense).toBe(5000);
    expect(augustReport.body.byCategory).toHaveLength(1);

    const septemberReport = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-09&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(septemberReport.body.totals.expense).toBe(0);
  });

  it("returns 200 with zeros and an empty byCategory for a month with no data", async () => {
    const { accessToken } = await registerAndLogin(app);

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({ income: 0, expense: 0, net: 0 });
    expect(response.body.byCategory).toEqual([]);
    expect(response.body.comparison).toBeNull();
  });

  it("computes totals, net, share by category and BigInt-safe JSON serialization", async () => {
    const { accessToken } = await registerAndLogin(app);
    const mercado = await createCategory(app, accessToken, { name: "Mercado", type: "EXPENSE" });
    const transporte = await createCategory(app, accessToken, { name: "Transporte", type: "EXPENSE" });
    const salario = await createCategory(app, accessToken, { name: "Salário", type: "INCOME" });

    await createTransaction(app, accessToken, {
      categoryId: mercado.id,
      type: "EXPENSE",
      amountCents: 187_600,
      occurredAt: "2026-08-05T12:00:00Z",
    });
    await createTransaction(app, accessToken, {
      categoryId: transporte.id,
      type: "EXPENSE",
      amountCents: 62_345,
      occurredAt: "2026-08-06T12:00:00Z",
    });
    await createTransaction(app, accessToken, {
      categoryId: salario.id,
      type: "INCOME",
      amountCents: 850_000,
      occurredAt: "2026-08-01T12:00:00Z",
    });

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({ income: 850_000, expense: 249_945, net: 600_055 });

    const mercadoGroup = response.body.byCategory.find((g: { name: string }) => g.name === "Mercado");
    expect(mercadoGroup.transactionCount).toBe(1);
    expect(mercadoGroup.share).toBeCloseTo(187_600 / 249_945, 4);
  });

  it("returns comparison: null when there is no data in the previous month", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken);

    await createTransaction(app, accessToken, {
      categoryId: category.id,
      type: "EXPENSE",
      amountCents: 1000,
      occurredAt: "2026-08-10T12:00:00Z",
    });

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.body.comparison).toBeNull();
  });

  it("computes expenseDelta against the previous month when data exists", async () => {
    const { accessToken } = await registerAndLogin(app);
    const category = await createCategory(app, accessToken);

    await createTransaction(app, accessToken, {
      categoryId: category.id,
      type: "EXPENSE",
      amountCents: 100_000,
      occurredAt: "2026-07-15T12:00:00Z",
    });
    await createTransaction(app, accessToken, {
      categoryId: category.id,
      type: "EXPENSE",
      amountCents: 58_800,
      occurredAt: "2026-08-15T12:00:00Z",
    });

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.body.comparison.previousMonth).toBe("2026-07");
    expect(response.body.comparison.expenseDelta).toBe(-41_200);
    expect(response.body.comparison.expenseDeltaPct).toBeCloseTo(-0.412, 3);
  });

  it("rejects an invalid month with 400 problem details", async () => {
    const { accessToken } = await registerAndLogin(app);

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-13&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.title).toBeDefined();
  });

  it("never leaks user B's transactions into user A's report", async () => {
    const userA = await registerAndLogin(app);
    const userB = await registerAndLogin(app);
    const categoryOfB = await createCategory(app, userB.accessToken);

    await createTransaction(app, userB.accessToken, {
      categoryId: categoryOfB.id,
      type: "EXPENSE",
      amountCents: 999_999,
      occurredAt: "2026-08-10T12:00:00Z",
    });

    const response = await request(app.server)
      .get("/api/v1/reports/monthly?month=2026-08&timezone=America/Sao_Paulo")
      .set("authorization", `Bearer ${userA.accessToken}`);

    expect(response.body.totals.expense).toBe(0);
  });
});
