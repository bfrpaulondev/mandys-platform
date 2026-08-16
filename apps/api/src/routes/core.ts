import { getTenantCoreSnapshot } from "@mandys/database";
import type { FastifyInstance } from "fastify";

import { getTenantContext } from "../auth/context";

export async function registerCoreRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/core", async (request) => {
    const context = await getTenantContext(request);
    const snapshot = await getTenantCoreSnapshot({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    return {
      data: {
        ...snapshot,
        currentRole: context.role,
      },
    };
  });
}
