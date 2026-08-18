import { forwardRuntimeRequest, upstreamUrl } from "../../../../lib/runtime-proxy";

const STOCK_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ all: string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(STOCK_UPSTREAM, request, all), {
    service: "stock",
    unavailableCode: "STOCK_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's stock runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const POST = proxy;
