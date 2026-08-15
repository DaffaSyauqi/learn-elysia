import { Elysia, t } from "elysia";

import {
  createUsersService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  type LoginUserInput,
  type RegisterUserInput,
  type UsersService,
} from "../services/users-service";

const invalidRegistrationResponse = {
  statusCode: 422,
  error: "Data registrasi tidak valid",
} as const;

const invalidLoginResponse = {
  statusCode: 422,
  error: "Data login tidak valid",
} as const;

function normalizeRegistrationInput(input: RegisterUserInput): RegisterUserInput {
  return {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

function isValidRegistrationInput(input: RegisterUserInput): boolean {
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

function normalizeLoginInput(input: LoginUserInput): LoginUserInput {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
}

function isValidLoginInput(input: LoginUserInput): boolean {
  return (
    input.email.length > 0 &&
    input.email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) &&
    input.password.length > 0 &&
    input.password.length <= 255
  );
}

export function createUsersRoutes(usersService: UsersService = createUsersService()) {
  const registrationRoutes = new Elysia({ prefix: "", normalize: false })
    .onError(({ code, set }) => {
      if (code === "VALIDATION" || code === "PARSE") {
        set.status = 422;
        return invalidRegistrationResponse;
      }
    })
    .post(
      "/",
      async ({ body, set }) => {
        const input = normalizeRegistrationInput(body);

        if (!isValidRegistrationInput(input)) {
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

  const loginRoutes = new Elysia({ prefix: "", normalize: false })
    .onError(({ code, set }) => {
      if (code === "VALIDATION" || code === "PARSE") {
        set.status = 422;
        return invalidLoginResponse;
      }
    })
    .post(
      "/login",
      async ({ body, set }) => {
        const input = normalizeLoginInput(body);

        if (!isValidLoginInput(input)) {
          set.status = 422;
          return invalidLoginResponse;
        }

        try {
          const token = await usersService.loginUser(input);
          set.status = 200;
          return { statusCode: 200, data: token } as const;
        } catch (error) {
          if (error instanceof InvalidCredentialsError) {
            set.status = 401;
            return { statusCode: 401, error: error.message } as const;
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
            email: t.String(),
            password: t.String({ minLength: 1, maxLength: 255 }),
          },
          { additionalProperties: false },
        ),
      },
    );

  return new Elysia({ prefix: "/api/users", normalize: false })
    .use(registrationRoutes)
    .use(loginRoutes);
}

export const usersRoutes = createUsersRoutes();
