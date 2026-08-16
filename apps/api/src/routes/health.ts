import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok" as const,
    service: "mandys-api" as const,
    timestamp: new Date().toISOString(),
  }));
}
