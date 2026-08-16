import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import { getEnvironment } from "./env";
import { registerAuthRoutes } from "./routes/auth";
import { registerCoreRoutes } from "./routes/core";
import { registerEventRoutes } from "./routes/events";
import { registerHealthRoutes } from "./routes/health";
import { registerMenuRoutes } from "./routes/menu";
import { registerOnboardingRoutes } from "./routes/onboarding";
import { registerPublicStorefrontRoutes } from "./routes/public-storefront";
import { registerReservationRoutes } from "./routes/reservations";

function getHttpStatus(error: unknown): number {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return 500;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 600
    ? statusCode
    : 500;
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnvironment();
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "password",
          "token",
          "apiKey",
          "body.password",
        ],
        censor: "[REDACTED]",
      },
    },
    trustProxy: true,
    bodyLimit: 1_048_576,
    requestIdHeader: "x-request-id",
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: [env.STOREFRONT_URL, env.BACKOFFICE_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-request-id", "x-csrf-token"],
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    ban: 5,
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    return payload;
  });

  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = getHttpStatus(error);
    const normalizedError = error instanceof Error ? error : new Error("Unknown error");

    if (statusCode >= 500) {
      request.log.error({ err: normalizedError }, "Unhandled API error");
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? "INTERNAL_ERROR" : normalizedError.name || "REQUEST_ERROR",
      message:
        statusCode >= 500 ? "An unexpected error occurred" : normalizedError.message,
      requestId: request.id,
    });
  });

  await registerHealthRoutes(app);
  await registerPublicStorefrontRoutes(app);
  await registerAuthRoutes(app);
  await registerOnboardingRoutes(app);
  await registerCoreRoutes(app);
  await registerReservationRoutes(app);
  await registerMenuRoutes(app);
  await registerEventRoutes(app);

  return app;
}
