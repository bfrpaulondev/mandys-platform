import { forwardRuntimeRequest, upstreamUrl } from "../../../../lib/runtime-proxy";

const RESERVATIONS_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ all: string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(RESERVATIONS_UPSTREAM, request, all), {
    service: "reservations",
    unavailableCode: "RESERVATIONS_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's reservations runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
