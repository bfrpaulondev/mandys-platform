import { forwardRuntimeRequest, upstreamUrl } from "../../../../../lib/runtime-proxy";

const CRM_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ all: string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  return forwardRuntimeRequest(request, upstreamUrl(CRM_UPSTREAM, request, all), {
    service: "crm",
    unavailableCode: "CRM_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's CRM runtime is temporarily unavailable",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
