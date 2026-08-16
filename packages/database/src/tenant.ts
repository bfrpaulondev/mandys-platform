import { sql as sqlFragment } from "drizzle-orm";

import { db } from "./client";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TenantDatabaseContext {
  organizationId: string;
  userId?: string;
}

export async function withTenant<T>(
  context: TenantDatabaseContext,
  work: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  if (!context.organizationId.trim()) {
    throw new Error("A tenant organization id is required");
  }

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sqlFragment`select set_config('app.organization_id', ${context.organizationId}, true)`,
    );

    if (context.userId) {
      await transaction.execute(sqlFragment`select set_config('app.user_id', ${context.userId}, true)`);
    }

    return work(transaction);
  });
}
