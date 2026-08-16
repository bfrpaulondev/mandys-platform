import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import { getEnvironment } from "./env";
import { registerAuthRoutes } from "./routes/auth";
import { registerHealthRoutes } from "./routes/health";
import { registerOnboardingRoutes } from "./routes/onboarding";

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
    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled API error");
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? "INTERNAL_ERROR" : error.name || "REQUEST_ERROR",
      message: statusCode >= 500 ? "An unexpected error occurred" : error.message,
      requestId: request.id,
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerOnboardingRoutes(app);

  return app;
}
