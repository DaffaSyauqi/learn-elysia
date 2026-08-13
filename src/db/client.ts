import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { requireDatabaseUrl } from "../config";
import * as schema from "./schema";

let pool: mysql.Pool | undefined;

export function getPool(): mysql.Pool {
  pool ??= mysql.createPool(requireDatabaseUrl());
  return pool;
}

export function getDatabase() {
  return drizzle({ client: getPool(), schema, mode: "default" });
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}
