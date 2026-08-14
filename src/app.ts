import { Elysia } from "elysia";

import { healthRoutes } from "./routes/health";
import { usersRoutes } from "./routes/users-route";

export const app = new Elysia()
  .get("/", () => ({ message: "Hello from Elysia" }))
  .use(healthRoutes)
  .use(usersRoutes);
