import { forwardRuntimeRequest, upstreamUrl } from "../../../../lib/runtime-proxy";

const SPECIAL_HOURS_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-special-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ all: string[] }>;
};

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(SPECIAL_HOURS_UPSTREAM, request, all), {
    service: "special-hours",
    unavailableCode: "SPECIAL_HOURS_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's special-hours runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const PUT = proxy;
export const DELETE = proxy;
