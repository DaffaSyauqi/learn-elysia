import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";

import { healthRoutes } from "./routes/health";
import { usersRoutes } from "./routes/users-route";

export const app = new Elysia()
  .use(
    openapi({
      path: "/openapi",
      provider: "swagger-ui",
      documentation: {
        info: {
          title: "Vibecode API",
          version: "1.0.0",
          description:
            "Dokumentasi API untuk registrasi, autentikasi, profil user, dan session.",
        },
        tags: [
          {
            name: "App",
            description: "Endpoint umum aplikasi",
          },
          {
            name: "Health",
            description: "Endpoint pemeriksaan kesehatan aplikasi dan database",
          },
          {
            name: "Users",
            description: "Endpoint registrasi dan profil user",
          },
          {
            name: "Authentication",
            description: "Endpoint login dan logout session user",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "UUID",
              description: "Session token yang diperoleh dari endpoint login",
            },
          },
        },
      },
    }),
  )
  .get(
    "/",
    () => ({ message: "Hello from Elysia" }),
    {
      detail: {
        summary: "Menampilkan response dasar aplikasi",
        tags: ["App"],
      },
    },
  )
  .use(healthRoutes)
  .use(usersRoutes);
