import { Elysia } from "elysia";

import { checkDatabaseConnection } from "../db/client";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get(
    "/",
    () => ({ status: "ok" }),
    {
      detail: {
        summary: "Memeriksa status aplikasi",
        tags: ["Health"],
      },
    },
  )
  .get(
    "/database",
    async ({ set }) => {
      try {
        await checkDatabaseConnection();
        return { status: "ok" };
      } catch {
        set.status = 503;
        return { status: "unavailable" };
      }
    },
    {
      detail: {
        summary: "Memeriksa koneksi database",
        description: "Memeriksa koneksi MySQL dari aplikasi ke database.",
        tags: ["Health"],
      },
    },
  );
