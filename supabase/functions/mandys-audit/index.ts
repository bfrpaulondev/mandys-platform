import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const projectUrl = "https://dbfmjdissqsdhxhmqkqp.supabase.co";
const authSessionUrl = `${projectUrl}/functions/v1/mandys-auth/api/auth/get-session`;
const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-audit-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(status: number, error: string, message: string): Result {
  return { status, body: { error, message } };
}

function cleanFilter(value: string | null, max: number): string | null {
  if (!value) return null;
  const next = value.trim();
  return next.length > 0 && next.length <= max ? next : null;
}

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") {
    return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  }
  const rows = await sql<{ role: string }[]>`
    select role from mandys.member
    where organization_id=${organizationId} and user_id=${userId}
    limit 1
  `;
  const role = rows[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function canRead(ctx: Context) {
  return ctx.role === "owner" || ctx.role === "manager";
}

async function listActivity(ctx: Context, url: URL): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can view the activity log");

  const action = cleanFilter(url.searchParams.get("action"), 120);
  const entityType = cleanFilter(url.searchParams.get("entityType"), 120);
  const actor = cleanFilter(url.searchParams.get("actor"), 255);
  const source = url.searchParams.get("source");
  const beforeRaw = url.searchParams.get("before");
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;
  const before = beforeRaw ? new Date(beforeRaw) : null;

  if (before && !Number.isFinite(before.getTime())) return fail(400, "INVALID_QUERY", "Activity cursor is invalid");
  if (source && !["team", "public", "system"].includes(source)) return fail(400, "INVALID_QUERY", "Activity source is invalid");

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;

    const rows = await tx<any[]>`
      select
        a.id,
        a.actor_user_id,
        u.name as actor_name,
        u.email as actor_email,
        a.action,
        a.entity_type,
        a.entity_id,
        a.request_id,
        a.metadata,
        a.created_at
      from mandys.audit_logs a
      left join mandys."user" u on u.id = a.actor_user_id
      where a.organization_id = ${ctx.organizationId}
        and (${action}::text is null or a.action = ${action})
        and (${entityType}::text is null or a.entity_type = ${entityType})
        and (${actor}::text is null or a.actor_user_id = ${actor})
        and (${before ? before.toISOString() : null}::timestamptz is null or a.created_at < ${before ? before.toISOString() : null}::timestamptz)
        and (
          ${source}::text is null
          or (${source} = 'team' and a.actor_user_id is not null)
          or (${source} = 'public' and a.actor_user_id is null and a.ip_hash is not null)
          or (${source} = 'system' and a.actor_user_id is null and a.ip_hash is null)
        )
      order by a.created_at desc, a.id desc
      limit ${limit + 1}
    `;

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor = hasMore && page.length > 0 ? new Date(page[page.length - 1].created_at).toISOString() : null;

    const summaryRows = await tx<any[]>`
      select
        count(*) filter (where created_at >= now() - interval '24 hours')::int as last_24h,
        count(*) filter (where created_at >= date_trunc('day', now()))::int as today,
        count(*) filter (where actor_user_id is not null and created_at >= now() - interval '7 days')::int as team_7d,
        count(*) filter (where actor_user_id is null and ip_hash is not null and created_at >= now() - interval '7 days')::int as public_7d
      from mandys.audit_logs
      where organization_id=${ctx.organizationId}
    `;

    const facetsRows = await tx<any[]>`
      select action, entity_type, count(*)::int as total
      from mandys.audit_logs
      where organization_id=${ctx.organizationId} and created_at >= now() - interval '30 days'
      group by action, entity_type
      order by total desc, action asc
      limit 60
    `;

    return {
      body: {
        data: page.map((row: any) => ({
          id: row.id,
          actorUserId: row.actor_user_id,
          actorName: row.actor_name,
          actorEmail: row.actor_email,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          requestId: row.request_id,
          metadata: row.metadata ?? {},
          createdAt: new Date(row.created_at).toISOString(),
          source: row.actor_user_id ? "team" : row.metadata?.source === "storefront" || row.action?.includes("public_") || row.action?.includes(".public_") ? "public" : "system",
        })),
        page: { hasMore, nextCursor },
        summary: summaryRows[0] ?? { last_24h: 0, today: 0, team_7d: 0, public_7d: 0 },
        facets: facetsRows.map((row: any) => ({ action: row.action, entityType: row.entity_type, total: row.total })),
      },
    };
  });
}

Deno.serve(async request => {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-audit"))) {
    return json({ ok: true, service: "mandys-audit" });
  }
  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    if (request.method === "GET" && path === "/v1/activity") {
      const result = await listActivity(ctxOrError, url);
      return json(result.body, result.status ?? 200);
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    console.error("mandys-audit error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Activity log could not be loaded" }, 500);
  }
});
