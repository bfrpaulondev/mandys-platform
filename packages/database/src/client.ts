import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDatabase = globalThis as unknown as {
  mandysSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDatabase.mandysSql ??
  postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.mandysSql = sql;
}

export const db = drizzle(sql, { schema });
export type Database = typeof db;
