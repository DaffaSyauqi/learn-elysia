import { Elysia } from "elysia";

import { checkDatabaseConnection } from "../db/client";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", () => ({ status: "ok" }))
  .get("/database", async ({ set }) => {
    try {
      await checkDatabaseConnection();
      return { status: "ok" };
    } catch {
      set.status = 503;
      return { status: "unavailable" };
    }
  });
