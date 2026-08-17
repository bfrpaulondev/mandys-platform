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
  connection: { application_name: "mandys-notifications-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
function fail(status: number, error: string, message: string): Result { return { status, body: { error, message } }; }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  const members = await sql<{ role: string }[]>`select role from mandys.member where organization_id=${organizationId} and user_id=${userId} limit 1`;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

async function listNotifications(ctx: Context, url: URL): Promise<Result> {
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    const rows = await tx<any[]>`
      select n.id,n.event_key,n.entity_type,n.entity_id,n.severity,n.title,n.body,n.metadata,n.created_at,r.read_at
      from mandys.notifications n
      left join mandys.notification_receipts r
        on r.organization_id=n.organization_id and r.notification_id=n.id and r.user_id=${ctx.userId}
      where n.organization_id=${ctx.organizationId}
        and (${unreadOnly} = false or r.read_at is null)
      order by n.created_at desc
      limit ${limit}
    `;
    const counts = await tx<any[]>`
      select count(*)::int as total,
        count(*) filter (where r.read_at is null)::int as unread
      from mandys.notifications n
      left join mandys.notification_receipts r
        on r.organization_id=n.organization_id and r.notification_id=n.id and r.user_id=${ctx.userId}
      where n.organization_id=${ctx.organizationId}
    `;
    return {
      body: {
        data: {
          notifications: rows.map((row: any) => ({
            id: row.id,
            eventKey: row.event_key,
            entityType: row.entity_type,
            entityId: row.entity_id,
            severity: row.severity,
            title: row.title,
            body: row.body,
            metadata: row.metadata ?? {},
            createdAt: new Date(row.created_at).toISOString(),
            readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
          })),
          total: counts[0]?.total ?? 0,
          unread: counts[0]?.unread ?? 0,
        },
      },
    };
  });
}

async function markRead(ctx: Context, notificationId: string): Promise<Result> {
  if (!isUuid(notificationId)) return fail(400, "INVALID_REQUEST", "Notification id is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    const notification = await tx<any[]>`select id from mandys.notifications where organization_id=${ctx.organizationId} and id=${notificationId}::uuid limit 1`;
    if (!notification[0]) return fail(404, "NOT_FOUND", "Notification not found");
    await tx`
      insert into mandys.notification_receipts (organization_id,notification_id,user_id,read_at)
      values (${ctx.organizationId},${notificationId}::uuid,${ctx.userId},now())
      on conflict (notification_id,user_id)
      do update set read_at=excluded.read_at
    `;
    return { body: { data: { id: notificationId, read: true } } };
  });
}

async function markAllRead(ctx: Context): Promise<Result> {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await tx`
      insert into mandys.notification_receipts (organization_id,notification_id,user_id,read_at)
      select n.organization_id,n.id,${ctx.userId},now()
      from mandys.notifications n
      where n.organization_id=${ctx.organizationId}
      on conflict (notification_id,user_id)
      do update set read_at=excluded.read_at
    `;
    return { body: { data: { readAll: true } } };
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-notifications"))) return json({ ok: true, service: "mandys-notifications" });
  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    let result: Result;
    if (request.method === "GET" && path === "/v1/notifications") result = await listNotifications(ctxOrError, url);
    else if (request.method === "PATCH" && /^\/v1\/notifications\/[0-9a-f-]+\/read$/i.test(path)) result = await markRead(ctxOrError, path.split("/")[3] ?? "");
    else if (request.method === "POST" && path === "/v1/notifications/read-all") result = await markAllRead(ctxOrError);
    else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-notifications error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Notifications could not be loaded" }, 500);
  }
});
