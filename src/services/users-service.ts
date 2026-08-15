import { eq } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { session, users } from "../db/schema";

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

type DatabaseProvider = () => ReturnType<typeof getDatabase>;

function isDuplicateEmailError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const databaseError = error as { code?: unknown; errno?: unknown };
  return databaseError.code === "ER_DUP_ENTRY" || databaseError.errno === 1062;
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

      const token = crypto.randomUUID();

      await database.insert(session).values({
        token,
        userId: user.id,
      });

      return token;
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
