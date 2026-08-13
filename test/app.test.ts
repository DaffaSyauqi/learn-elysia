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
