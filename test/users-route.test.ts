import { describe, expect, it } from "bun:test";

import { createUsersRoutes } from "../src/routes/users-route";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UnauthorizedError,
  type LoginUserInput,
  type RegisterUserInput,
  type UserProfile,
  type UsersService,
} from "../src/services/users-service";

function createRequest(path: string, body: string | object): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function createGetRequest(path: string, authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization) {
    headers.authorization = authorization;
  }
  return new Request(`http://localhost${path}`, { method: "GET", headers });
}

function createDeleteRequest(path: string, authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization) {
    headers.authorization = authorization;
  }
  return new Request(`http://localhost${path}`, { method: "DELETE", headers });
}

const mockProfile: UserProfile = {
  id: 1,
  name: "Daffa",
  email: "daffa@gmail.com",
  createdAt: new Date("2026-08-16T10:00:00.000Z"),
};

function createService(
  registerUser: (input: RegisterUserInput) => Promise<void>,
  loginUser: (input: LoginUserInput) => Promise<string>,
  getUserBySessionToken: (token: string) => Promise<UserProfile> = async () => mockProfile,
  logoutUser: (token: string) => Promise<void> = async () => {},
): UsersService {
  return { registerUser, loginUser, getUserBySessionToken, logoutUser };
}

describe("POST /api/users", () => {
  it("normalizes input and returns a success response", async () => {
    let receivedInput: RegisterUserInput | undefined;
    const app = createUsersRoutes(
      createService(
        async (input) => {
          receivedInput = input;
        },
        async () => "token-123",
      ),
    );

    const response = await app.handle(
      createRequest("/api/users", {
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
      createService(
        async () => {
          throw new EmailAlreadyRegisteredError();
        },
        async () => "token-123",
      ),
    );

    const response = await app.handle(
      createRequest("/api/users", { name: "Daffa", email: "daffa@gmail.com", password: "123" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      statusCode: 409,
      error: "Email sudah terdaftar",
    });
  });

  it("returns a safe response for unexpected errors", async () => {
    const app = createUsersRoutes(
      createService(
        async () => {
          throw new Error("database credentials leaked");
        },
        async () => "token-123",
      ),
    );

    const response = await app.handle(
      createRequest("/api/users", { name: "Daffa", email: "daffa@gmail.com", password: "123" }),
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
      const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));
      const response = await app.handle(createRequest("/api/users", body));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        statusCode: 422,
        error: "Data registrasi tidak valid",
      });
    });
  }
});

describe("POST /api/users/login", () => {
  it("returns a token for valid credentials", async () => {
    const app = createUsersRoutes(
      createService(
        async () => {},
        async () => "token-123",
      ),
    );

    const response = await app.handle(
      createRequest("/api/users/login", { email: "daffa@gmail.com", password: "123" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ statusCode: 200, data: "token-123" });
  });

  it("returns invalid credentials for wrong password", async () => {
    const app = createUsersRoutes(
      createService(
        async () => {},
        async () => {
          throw new InvalidCredentialsError();
        },
      ),
    );

    const response = await app.handle(
      createRequest("/api/users/login", { email: "daffa@gmail.com", password: "wrong" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Email atau password salah",
    });
  });

  it("returns a safe response for unexpected errors", async () => {
    const app = createUsersRoutes(
      createService(
        async () => {},
        async () => {
          throw new Error("database credentials leaked");
        },
      ),
    );

    const response = await app.handle(
      createRequest("/api/users/login", { email: "daffa@gmail.com", password: "123" }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      error: "Terjadi kesalahan pada server",
    });
  });

  const invalidLoginBodies: Array<[string, string | object]> = [
    ["missing email", { password: "123" }],
    ["missing password", { email: "daffa@gmail.com" }],
    ["wrong field type", { email: 123, password: "123" }],
    ["blank email", { email: "   ", password: "123" }],
    ["invalid email", { email: "not-an-email", password: "123" }],
    ["empty password", { email: "daffa@gmail.com", password: "" }],
    [
      "email over 255 characters",
      { email: `${"a".repeat(244)}@example.com`, password: "123" },
    ],
    [
      "password over 255 characters",
      { email: "daffa@gmail.com", password: "a".repeat(256) },
    ],
    [
      "additional field",
      { email: "daffa@gmail.com", password: "123", role: "admin" },
    ],
    ["malformed JSON", "{"],
  ];

  for (const [scenario, body] of invalidLoginBodies) {
    it(`returns validation error for ${scenario}`, async () => {
      const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));
      const response = await app.handle(createRequest("/api/users/login", body));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        statusCode: 422,
        error: "Data login tidak valid",
      });
    });
  }
});

describe("GET /api/users/me", () => {
  it("returns the user profile for a valid bearer token", async () => {
    let receivedToken: string | undefined;
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async (token) => {
        receivedToken = token;
        return mockProfile;
      }),
    );

    const response = await app.handle(
      createGetRequest("/api/users/me", "Bearer token-abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      statusCode: 200,
      data: {
        id: 1,
        name: "Daffa",
        email: "daffa@gmail.com",
        created_at: "2026-08-16T10:00:00.000Z",
      },
    });
    expect(receivedToken).toBe("token-abc");
  });

  it("returns unauthorized when the authorization header is missing", async () => {
    const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));

    const response = await app.handle(createGetRequest("/api/users/me"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });

  const invalidAuthorizations: Array<[string, string | undefined]> = [
    ["plain token without Bearer scheme", "token-abc"],
    ["empty token", "Bearer "],
    ["extra whitespace", "Bearer  "],
    ["empty header value", ""],
  ];

  for (const [scenario, authorization] of invalidAuthorizations) {
    it(`returns unauthorized for ${scenario}`, async () => {
      const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));

      const response = await app.handle(
        createGetRequest("/api/users/me", authorization),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        statusCode: 401,
        error: "Unauthorized",
      });
    });
  }

  it("returns unauthorized for a token with no matching session", async () => {
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async () => {
        throw new UnauthorizedError();
      }),
    );

    const response = await app.handle(
      createGetRequest("/api/users/me", "Bearer unknown-token"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });

  it("returns a safe response for unexpected errors", async () => {
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async () => {
        throw new Error("database credentials leaked");
      }),
    );

    const response = await app.handle(
      createGetRequest("/api/users/me", "Bearer token-abc"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      error: "Terjadi kesalahan pada server",
    });
  });

  it("does not expose the password or session token in the response", async () => {
    const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));

    const response = await app.handle(
      createGetRequest("/api/users/me", "Bearer token-abc"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("token-abc");
  });
});

describe("DELETE /api/users/logout", () => {
  it("returns OK for a valid bearer token", async () => {
    let receivedToken: string | undefined;
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async () => mockProfile, async (token) => {
        receivedToken = token;
      }),
    );

    const response = await app.handle(
      createDeleteRequest("/api/users/logout", "Bearer token-abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ statusCode: 200, data: "OK" });
    expect(receivedToken).toBe("token-abc");
  });

  it("returns unauthorized when the authorization header is missing", async () => {
    const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));

    const response = await app.handle(createDeleteRequest("/api/users/logout"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });

  const invalidAuthorizations: Array<[string, string | undefined]> = [
    ["plain token without Bearer scheme", "token-abc"],
    ["empty token", "Bearer "],
    ["extra whitespace", "Bearer  "],
    ["empty header value", ""],
  ];

  for (const [scenario, authorization] of invalidAuthorizations) {
    it(`returns unauthorized for ${scenario}`, async () => {
      const app = createUsersRoutes(createService(async () => {}, async () => "token-123"));

      const response = await app.handle(
        createDeleteRequest("/api/users/logout", authorization),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        statusCode: 401,
        error: "Unauthorized",
      });
    });
  }

  it("returns unauthorized when the session is not found", async () => {
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async () => mockProfile, async () => {
        throw new UnauthorizedError();
      }),
    );

    const response = await app.handle(
      createDeleteRequest("/api/users/logout", "Bearer unknown-token"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });

  it("returns a safe response for unexpected errors", async () => {
    const app = createUsersRoutes(
      createService(async () => {}, async () => "token-123", async () => mockProfile, async () => {
        throw new Error("database credentials leaked");
      }),
    );

    const response = await app.handle(
      createDeleteRequest("/api/users/logout", "Bearer token-abc"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      error: "Terjadi kesalahan pada server",
    });
  });
});
