import { Elysia } from "elysia";

import { healthRoutes } from "./routes/health";

export const app = new Elysia()
  .get("/", () => ({ message: "Hello from Elysia" }))
  .use(healthRoutes);
