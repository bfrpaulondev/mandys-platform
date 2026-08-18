import { forwardRuntimeRequest, upstreamUrl } from "../../../../../lib/runtime-proxy";

const ORDERS_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ all: string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(ORDERS_UPSTREAM, request, all), {
    service: "orders",
    unavailableCode: "ORDERS_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's orders runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const PATCH = proxy;
