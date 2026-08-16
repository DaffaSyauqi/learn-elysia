import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

import { session, users } from "../src/db/schema";
import { createUsersRoutes } from "../src/routes/users-route";
import { createUsersService } from "../src/services/users-service";

const testDatabaseUrl = Bun.env.DATABASE_URL_TEST;

if (testDatabaseUrl && testDatabaseUrl === Bun.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST must not be the same as DATABASE_URL");
}

describe.skipIf(!testDatabaseUrl)("user registration integration", () => {
  const pool = testDatabaseUrl ? mysql.createPool(testDatabaseUrl) : undefined;
  const database = pool
    ? drizzle({ client: pool, schema: { users, session }, mode: "default" })
    : undefined;
  const app = createUsersRoutes(createUsersService(() => database!));

  beforeAll(async () => {
    if (database) {
      await migrate(database, { migrationsFolder: "./drizzle" });
    }
  });

  beforeEach(async () => {
    if (database) {
      await database.delete(session);
      await database.delete(users);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  function register(name: string, email: string, password = "123") {
    return app.handle(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }),
    );
  }

  it("stores normalized user data and a bcrypt password hash", async () => {
    const response = await register("  Daffa  ", "  Daffa@Gmail.com  ");
    const storedUsers = await database!.select().from(users);

    expect(response.status).toBe(200);
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0]?.name).toBe("Daffa");
    expect(storedUsers[0]?.email).toBe("daffa@gmail.com");
    expect(storedUsers[0]?.password).not.toBe("123");
    expect(storedUsers[0]?.password.startsWith("$2")).toBe(true);
    expect(await Bun.password.verify("123", storedUsers[0]!.password)).toBe(true);
  });

  it("returns conflict for a normalized duplicate email", async () => {
    await register("Daffa", "daffa@gmail.com");
    const response = await register("Daffa 2", "  DAFFA@gmail.com ");
    const storedUsers = await database!.select().from(users);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      statusCode: 409,
      error: "Email sudah terdaftar",
    });
    expect(storedUsers).toHaveLength(1);
  });

  it("allows exactly one of two concurrent registrations", async () => {
    const responses = await Promise.all([
      register("Daffa 1", "same@gmail.com"),
      register("Daffa 2", "same@gmail.com"),
    ]);
    const storedUsers = await database!.select().from(users);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(storedUsers).toHaveLength(1);
  });
});

describe.skipIf(!testDatabaseUrl)("user login integration", () => {
  const pool = testDatabaseUrl ? mysql.createPool(testDatabaseUrl) : undefined;
  const database = pool
    ? drizzle({ client: pool, schema: { users, session }, mode: "default" })
    : undefined;
  const app = createUsersRoutes(createUsersService(() => database!));

  beforeAll(async () => {
    if (database) {
      await migrate(database, { migrationsFolder: "./drizzle" });
    }
  });

  beforeEach(async () => {
    if (database) {
      await database.delete(session);
      await database.delete(users);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("returns a token for valid credentials", async () => {
    await register("Daffa", "daffa@gmail.com");
    const response = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "daffa@gmail.com", password: "123" }),
      }),
    );
    const storedSessions = await database!.select().from(session);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ statusCode: 200, data: expect.any(String) });
    expect(body.data).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.token).toBe(body.data);
    expect(storedSessions[0]?.userId).toBe(1);
  });

  it("normalizes email before lookup", async () => {
    await register("Daffa", "daffa@gmail.com");
    const response = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "  DAFFA@gmail.com ", password: "123" }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("returns invalid credentials for unknown email", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com", password: "123" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Email atau password salah",
    });
  });

  it("returns invalid credentials for wrong password", async () => {
    await register("Daffa", "daffa@gmail.com");
    const response = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "daffa@gmail.com", password: "wrong" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Email atau password salah",
    });
  });

  it("does not create a session for invalid credentials", async () => {
    await register("Daffa", "daffa@gmail.com");
    const response = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "daffa@gmail.com", password: "wrong" }),
      }),
    );
    const storedSessions = await database!.select().from(session);

    expect(response.status).toBe(401);
    expect(storedSessions).toHaveLength(0);
  });

  it("creates a separate session for each successful login", async () => {
    await register("Daffa", "daffa@gmail.com");
    const first = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "daffa@gmail.com", password: "123" }),
      }),
    );
    const second = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "daffa@gmail.com", password: "123" }),
      }),
    );
    const storedSessions = await database!.select().from(session);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.data).not.toBe(secondBody.data);
    expect(storedSessions).toHaveLength(2);
  });

  function register(name: string, email: string, password = "123") {
    return app.handle(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }),
    );
  }
});

describe.skipIf(!testDatabaseUrl)("user profile integration", () => {
  const pool = testDatabaseUrl ? mysql.createPool(testDatabaseUrl) : undefined;
  const database = pool
    ? drizzle({ client: pool, schema: { users, session }, mode: "default" })
    : undefined;
  const app = createUsersRoutes(createUsersService(() => database!));

  beforeAll(async () => {
    if (database) {
      await migrate(database, { migrationsFolder: "./drizzle" });
    }
  });

  beforeEach(async () => {
    if (database) {
      await database.delete(session);
      await database.delete(users);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function registerAndLogin(email = "daffa@gmail.com") {
    await app.handle(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Daffa", email, password: "123" }),
      }),
    );
    const login = await app.handle(
      new Request("http://localhost/api/users/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "123" }),
      }),
    );
    const body = await login.json();
    return body.data as string;
  }

  function getProfile(token?: string) {
    const headers: Record<string, string> = {};
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    return app.handle(new Request("http://localhost/api/users/me", { method: "GET", headers }));
  }

  it("returns the profile for a valid session token", async () => {
    const token = await registerAndLogin();

    const response = await getProfile(token);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      statusCode: 200,
      data: {
        id: expect.any(Number),
        name: "Daffa",
        email: "daffa@gmail.com",
        created_at: expect.any(String),
      },
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("returns unauthorized when the token has no matching session", async () => {
    const response = await getProfile("unknown-token");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });

  it("returns unauthorized when no token is provided", async () => {
    const response = await getProfile();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      error: "Unauthorized",
    });
  });
});
