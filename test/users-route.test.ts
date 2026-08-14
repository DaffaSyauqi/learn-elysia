import { describe, expect, it } from "bun:test";

import { createUsersRoutes } from "../src/routes/users-route";
import {
  EmailAlreadyRegisteredError,
  type RegisterUserInput,
  type UsersService,
} from "../src/services/users-service";

function createRequest(body: string | object): Request {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function createService(
  registerUser: (input: RegisterUserInput) => Promise<void>,
): UsersService {
  return { registerUser };
}

describe("POST /api/users", () => {
  it("normalizes input and returns a success response", async () => {
    let receivedInput: RegisterUserInput | undefined;
    const app = createUsersRoutes(
      createService(async (input) => {
        receivedInput = input;
      }),
    );

    const response = await app.handle(
      createRequest({
        name: "  Daffa  ",
        email: "  Daffa@Gmail.com  ",
        password: "123",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ statusCode: 200, data: "OK" });
    expect(receivedInput).toEqual({
      name: "Daffa",
      email: "daffa@gmail.com",
      password: "123",
    });
  });

  it("returns conflict when the email is already registered", async () => {
    const app = createUsersRoutes(
      createService(async () => {
        throw new EmailAlreadyRegisteredError();
      }),
    );

    const response = await app.handle(
      createRequest({ name: "Daffa", email: "daffa@gmail.com", password: "123" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      statusCode: 409,
      error: "Email sudah terdaftar",
    });
  });

  it("returns a safe response for unexpected errors", async () => {
    const app = createUsersRoutes(
      createService(async () => {
        throw new Error("database credentials leaked");
      }),
    );

    const response = await app.handle(
      createRequest({ name: "Daffa", email: "daffa@gmail.com", password: "123" }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      error: "Terjadi kesalahan pada server",
    });
  });

  const invalidBodies: Array<[string, string | object]> = [
    ["missing field", { name: "Daffa", email: "daffa@gmail.com" }],
    ["wrong field type", { name: 123, email: "daffa@gmail.com", password: "123" }],
    ["blank name", { name: "   ", email: "daffa@gmail.com", password: "123" }],
    ["invalid email", { name: "Daffa", email: "not-an-email", password: "123" }],
    ["empty password", { name: "Daffa", email: "daffa@gmail.com", password: "" }],
    [
      "name over 255 characters",
      { name: "a".repeat(256), email: "daffa@gmail.com", password: "123" },
    ],
    [
      "email over 255 characters",
      { name: "Daffa", email: `${"a".repeat(244)}@example.com`, password: "123" },
    ],
    [
      "password over 255 characters",
      { name: "Daffa", email: "daffa@gmail.com", password: "a".repeat(256) },
    ],
    [
      "additional field",
      { name: "Daffa", email: "daffa@gmail.com", password: "123", role: "admin" },
    ],
    ["malformed JSON", "{"],
  ];

  for (const [scenario, body] of invalidBodies) {
    it(`returns validation error for ${scenario}`, async () => {
      const app = createUsersRoutes(createService(async () => {}));
      const response = await app.handle(createRequest(body));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        statusCode: 422,
        error: "Data registrasi tidak valid",
      });
    });
  }
});
