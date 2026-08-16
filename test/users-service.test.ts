import { describe, expect, it } from "bun:test";

import { getDatabase } from "../src/db/client";
import {
  createUsersService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "../src/services/users-service";

type Database = ReturnType<typeof getDatabase>;

describe("users service", () => {
  it("stores a bcrypt hash instead of the plaintext password", async () => {
    let insertedValues: Record<string, string> | undefined;
    const database = {
      insert: () => ({
        values: async (values: Record<string, string>) => {
          insertedValues = values;
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ password: "hash" }],
          }),
        }),
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    await service.registerUser({
      name: "Daffa",
      email: "daffa@gmail.com",
      password: "123",
    });

    expect(insertedValues?.name).toBe("Daffa");
    expect(insertedValues?.email).toBe("daffa@gmail.com");
    const passwordHash = insertedValues!.password!;
    expect(passwordHash).not.toBe("123");
    expect(passwordHash.startsWith("$2")).toBe(true);
    expect(await Bun.password.verify("123", passwordHash)).toBe(true);
  });

  for (const databaseError of [
    { code: "ER_DUP_ENTRY" },
    { errno: 1062 },
  ]) {
    it("maps a duplicate database error to the email domain error", async () => {
      const database = {
        insert: () => ({
          values: async () => {
            throw databaseError;
          },
        }),
      } as unknown as Database;
      const service = createUsersService(() => database);

      expect(
        service.registerUser({
          name: "Daffa",
          email: "daffa@gmail.com",
          password: "123",
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });
  }

  it("preserves unexpected database errors", async () => {
    const databaseError = new Error("connection unavailable");
    const database = {
      insert: () => ({
        values: async () => {
          throw databaseError;
        },
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    expect(
      service.registerUser({
        name: "Daffa",
        email: "daffa@gmail.com",
        password: "123",
      }),
    ).rejects.toBe(databaseError);
  });

  it("returns a token for valid credentials", async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: 1, email: "daffa@gmail.com", password: await Bun.password.hash("123", { algorithm: "bcrypt", cost: 10 }) },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: async (values: Record<string, string | number>) => {
          expect(values.token).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          expect(values.userId).toBe(1);
        },
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    const token = await service.loginUser({ email: "daffa@gmail.com", password: "123" });
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("normalizes email before lookup", async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: 1, email: "daffa@gmail.com", password: await Bun.password.hash("123", { algorithm: "bcrypt", cost: 10 }) },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: async (values: Record<string, string | number>) => {
          expect(values.token).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          expect(values.userId).toBe(1);
        },
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    const token = await service.loginUser({ email: "  DAFFA@gmail.com ", password: "123" });
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("returns invalid credentials for unknown email", async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
      insert: () => ({
        values: async () => {},
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    expect(
      service.loginUser({ email: "unknown@example.com", password: "123" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("returns invalid credentials for wrong password", async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: 1, email: "daffa@gmail.com", password: await Bun.password.hash("123", { algorithm: "bcrypt", cost: 10 }) },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: async () => {},
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    expect(
      service.loginUser({ email: "daffa@gmail.com", password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe("users service getUserBySessionToken", () => {
  it("returns the user profile for a matching session token", async () => {
    let whereToken: string | undefined;
    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: (condition: unknown) => {
              whereToken = condition as string;
              return {
                limit: async () => [
                  {
                    id: 1,
                    name: "Daffa",
                    email: "daffa@gmail.com",
                    createdAt: new Date("2026-08-16T10:00:00.000Z"),
                  },
                ],
              };
            },
          }),
        }),
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    const user = await service.getUserBySessionToken("token-abc");

    expect(user).toEqual({
      id: 1,
      name: "Daffa",
      email: "daffa@gmail.com",
      createdAt: new Date("2026-08-16T10:00:00.000Z"),
    });
    expect(whereToken).toBeDefined();
  });

  it("selects only the profile fields from the users table", async () => {
    let selectedColumns: unknown;
    const database = {
      select: (columns: unknown) => {
        selectedColumns = columns;
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        };
      },
    } as unknown as Database;
    const service = createUsersService(() => database);

    await expect(
      service.getUserBySessionToken("token-abc"),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(Object.keys(selectedColumns as Record<string, unknown>)).toEqual([
      "id",
      "name",
      "email",
      "createdAt",
    ]);
  });

  it("throws unauthorized when no session matches the token", async () => {
    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
      }),
    } as unknown as Database;
    const service = createUsersService(() => database);

    expect(
      service.getUserBySessionToken("unknown-token"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
