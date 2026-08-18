import { forwardRuntimeRequest, upstreamUrl } from "../../../../../lib/runtime-proxy";

const ADMIN_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ all: string[] }>;
};

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(ADMIN_UPSTREAM, request, all), {
    service: "admin",
    unavailableCode: "RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
