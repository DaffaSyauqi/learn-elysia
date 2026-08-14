import { Elysia, t } from "elysia";

import {
  createUsersService,
  EmailAlreadyRegisteredError,
  type RegisterUserInput,
  type UsersService,
} from "../services/users-service";

const invalidRegistrationResponse = {
  statusCode: 422,
  error: "Data registrasi tidak valid",
} as const;

function normalizeInput(input: RegisterUserInput): RegisterUserInput {
  return {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

function isValidInput(input: RegisterUserInput): boolean {
  return (
    input.name.length > 0 &&
    input.name.length <= 255 &&
    input.email.length > 0 &&
    input.email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) &&
    input.password.length > 0 &&
    input.password.length <= 255
  );
}

export function createUsersRoutes(usersService: UsersService = createUsersService()) {
  return new Elysia({ prefix: "/api/users", normalize: false })
    .onError(({ code, set }) => {
      if (code === "VALIDATION" || code === "PARSE") {
        set.status = 422;
        return invalidRegistrationResponse;
      }
    })
    .post(
      "/",
      async ({ body, set }) => {
        const input = normalizeInput(body);

        if (!isValidInput(input)) {
          set.status = 422;
          return invalidRegistrationResponse;
        }

        try {
          await usersService.registerUser(input);
          set.status = 200;
          return { statusCode: 200, data: "OK" } as const;
        } catch (error) {
          if (error instanceof EmailAlreadyRegisteredError) {
            set.status = 409;
            return { statusCode: 409, error: error.message } as const;
          }

          set.status = 500;
          return {
            statusCode: 500,
            error: "Terjadi kesalahan pada server",
          } as const;
        }
      },
      {
        body: t.Object(
          {
            name: t.String(),
            email: t.String(),
            password: t.String({ minLength: 1, maxLength: 255 }),
          },
          { additionalProperties: false },
        ),
      },
    );
}

export const usersRoutes = createUsersRoutes();
