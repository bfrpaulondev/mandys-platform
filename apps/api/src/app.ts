import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import { getEnvironment } from "./env";
import { registerHealthRoutes } from "./routes/health";

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

  await registerHealthRoutes(app);

  return app;
}
