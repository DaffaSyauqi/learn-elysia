import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

import { users } from "../src/db/schema";
import { createUsersRoutes } from "../src/routes/users-route";
import { createUsersService } from "../src/services/users-service";

const testDatabaseUrl = Bun.env.DATABASE_URL_TEST;

if (testDatabaseUrl && testDatabaseUrl === Bun.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST must not be the same as DATABASE_URL");
}

describe.skipIf(!testDatabaseUrl)("user registration integration", () => {
  const pool = testDatabaseUrl ? mysql.createPool(testDatabaseUrl) : undefined;
  const database = pool
    ? drizzle({ client: pool, schema: { users }, mode: "default" })
    : undefined;
  const app = createUsersRoutes(createUsersService(() => database!));

  beforeAll(async () => {
    if (database) {
      await migrate(database, { migrationsFolder: "./drizzle" });
    }
  });

  beforeEach(async () => {
    if (database) {
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
