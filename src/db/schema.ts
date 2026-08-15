import { foreignKey, index, int, mysqlTable, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int().autoincrement().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const session = mysqlTable(
  "session",
  {
    id: int().autoincrement().primaryKey(),
    token: varchar({ length: 255 }).notNull(),
    userId: int("user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenKey: unique("session_token_unique").on(table.token),
    userIdIndex: index("session_user_id_index").on(table.userId),
    userKey: foreignKey({
      name: "session_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  }),
);
