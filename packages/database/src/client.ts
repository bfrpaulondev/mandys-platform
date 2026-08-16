import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl =
  process.env.DATABASE_URL ??
  (isProduction ? undefined : "postgres://postgres:postgres@127.0.0.1:5432/mandys");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required in production");
}

const globalForDatabase = globalThis as unknown as {
  mandysSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDatabase.mandysSql ??
  postgres(databaseUrl, {
    max: isProduction ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (!isProduction) {
  globalForDatabase.mandysSql = sql;
}

export const db = drizzle(sql, { schema });
export type Database = typeof db;
