import { eq } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { session, users } from "../db/schema";
import crypto from "crypto";

export type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginUserInput = {
  email: string;
  password: string;
};

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email sudah terdaftar");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email atau password salah");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
};

type DatabaseProvider = () => ReturnType<typeof getDatabase>;

function isDuplicateEmailError(error: unknown): boolean {
  // Drizzle / mysql2 may wrap the underlying driver error. Walk a few layers
  // of nested properties (cause, originalError, err) to find the real DB error.
  if (!error) return false;

  let e: any = error as any;
  const visited = new Set<any>();
  for (let depth = 0; depth < 6 && e && typeof e === "object"; depth++) {
    if (visited.has(e)) break;
    visited.add(e);

    const code = e.code;
    const errno = e.errno;
    const message = e.message || e.sqlMessage || "";

    if (code === "ER_DUP_ENTRY" || errno === 1062) return true;
    if (typeof message === "string" && /duplicate entry|er_dup_entry|duplicate key/i.test(message)) return true;

    e = e.cause ?? e.originalError ?? e.err ?? e.driverError ?? e.sqlError ?? null;
  }

  return false;
}

export function createUsersService(databaseProvider: DatabaseProvider = getDatabase) {
  return {
    async registerUser(input: RegisterUserInput): Promise<void> {
      const passwordHash = await Bun.password.hash(input.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      try {
        await databaseProvider().insert(users).values({
          name: input.name,
          email: input.email,
          password: passwordHash,
        });
      } catch (error) {
        if (isDuplicateEmailError(error)) {
          throw new EmailAlreadyRegisteredError();
        }

        throw error;
      }
    },

    async loginUser(input: LoginUserInput): Promise<string> {
      const database = databaseProvider();

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.email, input.email.trim().toLowerCase()))
        .limit(1);

      if (!user || !(await Bun.password.verify(input.password, user.password))) {
        throw new InvalidCredentialsError();
      }

      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const token = crypto.randomUUID();
        try {
          await database.insert(session).values({
            token,
            userId: user.id,
          });

          return token;
        } catch (error) {
          // detect unique token collision (very unlikely) and retry a few times
          const msg = String((error && (error as any).message) || error);
          const isUniqueCollision = /duplicate key|unique constraint|ER_DUP_ENTRY|Duplicate entry/i.test(msg);
          if (!isUniqueCollision) {
            throw error;
          }
          // otherwise loop to retry
        }
      }

      throw new Error("Gagal membuat session token setelah beberapa percobaan");
    },

    async getUserBySessionToken(token: string): Promise<UserProfile> {
      const [user] = await databaseProvider()
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(session)
        .innerJoin(users, eq(session.userId, users.id))
        .where(eq(session.token, token))
        .limit(1);

      if (!user) {
        throw new UnauthorizedError();
      }

      return user;
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
