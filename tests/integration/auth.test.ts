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
import { registerAndLogin, uniqueEmail } from "./helpers/fixtures.js";

describe("auth", () => {
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

  it("registers a new user with 201 and never returns the password hash", async () => {
    const email = uniqueEmail();
    const response = await request(app.server)
      .post("/api/v1/auth/register")
      .send({ email, password: "super-secret-password" });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe(email);
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("rejects duplicate email registration with 409", async () => {
    const email = uniqueEmail();
    await request(app.server).post("/api/v1/auth/register").send({ email, password: "super-secret-password" });

    const response = await request(app.server)
      .post("/api/v1/auth/register")
      .send({ email, password: "another-password" });

    expect(response.status).toBe(409);
  });

  it("logs in and returns an access + refresh token pair", async () => {
    const { accessToken, refreshToken } = await registerAndLogin(app);
    expect(typeof accessToken).toBe("string");
    expect(typeof refreshToken).toBe("string");
  });

  it("rejects login with wrong password with 401", async () => {
    const email = uniqueEmail();
    await request(app.server).post("/api/v1/auth/register").send({ email, password: "super-secret-password" });

    const response = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("rotates the refresh token: old token cannot be used twice", async () => {
    const { refreshToken } = await registerAndLogin(app);

    const first = await request(app.server).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    const secondUseOfOldToken = await request(app.server)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(secondUseOfOldToken.status).toBe(401);
  });

  it("revokes the refresh token on logout so it can no longer authenticate", async () => {
    const { refreshToken } = await registerAndLogin(app);

    const logoutResponse = await request(app.server).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogout = await request(app.server)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("rejects protected routes without a valid access token", async () => {
    const response = await request(app.server).get("/api/v1/categories");
    expect(response.status).toBe(401);
  });
});
