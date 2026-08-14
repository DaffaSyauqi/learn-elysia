import { describe, expect, it } from "bun:test";

import { getDatabase } from "../src/db/client";
import {
  createUsersService,
  EmailAlreadyRegisteredError,
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
});
