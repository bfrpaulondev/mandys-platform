import { auth } from "@mandys/auth";
import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import { getTenantContext } from "../auth/context";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute",
      },
    },
    async handler(request, reply) {
      const protocol = request.protocol;
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url, `${protocol}://${host}`);
      const headers = fromNodeHeaders(request.headers);

      const authRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });

      const response = await auth.handler(authRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      const body = response.body ? await response.text() : null;
      return reply.send(body);
    },
  });

  app.get("/v1/me", async (request) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return {
        authenticated: false,
        user: null,
        tenant: null,
      };
    }

    let tenant = null;
    try {
      tenant = await getTenantContext(request);
    } catch {
      // A signed-in user may legitimately not have selected an organization yet.
    }

    return {
      authenticated: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
      tenant,
    };
  });
}
