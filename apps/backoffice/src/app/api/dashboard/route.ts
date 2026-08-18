import { forwardRuntimeRequest } from "../../../lib/runtime-proxy";

const DASHBOARD_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-dashboard/v1/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return forwardRuntimeRequest(request, new URL(DASHBOARD_UPSTREAM), {
    service: "dashboard",
    unavailableCode: "DASHBOARD_RUNTIME_UNAVAILABLE",
    unavailableMessage: "Mandy's dashboard is temporarily unavailable",
  });
}
