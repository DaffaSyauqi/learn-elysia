import { describe, expect, it } from "bun:test";

import { app } from "../src/app";

describe("application routes", () => {
  it("returns the root greeting", async () => {
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Hello from Elysia" });
  });

  it("reports application health", async () => {
    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("openapi documentation", () => {
  it("serves the swagger ui documentation page", async () => {
    const response = await app.handle(new Request("http://localhost/openapi"));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it("serves the raw openapi specification", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));

    expect(response.status).toBe(200);
    const document = await response.json();

    expect(document.info.title).toBe("Vibecode API");
    expect(document.info.version).toBe("1.0.0");
  });

  it("documents every api path", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));
    const document = await response.json();

    expect(document.paths["/"]).toBeDefined();
    expect(document.paths["/api/users/"]).toBeDefined();
    expect(document.paths["/api/users/login"]).toBeDefined();
    expect(document.paths["/api/users/me"]).toBeDefined();
    expect(document.paths["/api/users/logout"]).toBeDefined();
    expect(document.paths["/health/"]).toBeDefined();
    expect(document.paths["/health/database"]).toBeDefined();
  });

  it("defines the bearer security scheme", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));
    const document = await response.json();

    expect(document.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "UUID",
      description: "Session token yang diperoleh dari endpoint login",
    });
  });

  it("marks protected endpoints with bearer security", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));
    const document = await response.json();

    expect(document.paths["/api/users/me"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths["/api/users/logout"].delete.security).toEqual([{ bearerAuth: [] }]);
  });

  it("does not mark public endpoints as protected", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));
    const document = await response.json();

    expect(document.paths["/api/users/"].post.security).toBeUndefined();
    expect(document.paths["/api/users/login"].post.security).toBeUndefined();
  });
});
