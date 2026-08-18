import { forwardRuntimeRequest, upstreamUrl } from "../../../../../lib/runtime-proxy";

const MENU_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ all: string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(MENU_UPSTREAM, request, all), {
    service: "menu",
    unavailableCode: "MENU_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's menu runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
