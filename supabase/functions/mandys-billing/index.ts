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
  connection: {
    application_name: "mandys-billing-edge",
    search_path: "mandys,public",
  },
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

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");

  const response = await fetch(authSessionUrl, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");

  const body = (await response.json().catch(() => null)) as Record<string, any> | null;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") {
    return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  }

  const members = await sql<{ role: string }[]>`
    select role
    from mandys.member
    where organization_id=${organizationId} and user_id=${userId}
    limit 1
  `;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

async function billing(ctx: Context): Promise<Result> {
  if (!["owner", "manager", "accounting"].includes(ctx.role)) {
    return fail(403, "FORBIDDEN", "Your role cannot access subscription information");
  }

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;

    // Keep reads sequential on this transaction connection so the tenant context
    // above is guaranteed to apply to every tenant-owned query.
    const subscriptionRows = await tx<any[]>`
      select s.id,
             s.plan_key,
             s.status,
             s.trial_started_at,
             s.trial_ends_at,
             s.current_period_started_at,
             s.current_period_ends_at,
             s.cancel_at_period_end,
             s.provider,
             s.created_at,
             p.display_name
      from mandys.tenant_subscriptions s
      join mandys.saas_plans p on p.plan_key=s.plan_key
      where s.organization_id=${ctx.organizationId}
      limit 1
    `;
    const plans = await tx<any[]>`
      select plan_key,
             display_name,
             position,
             monthly_price_cents,
             annual_price_cents,
             currency,
             is_public,
             is_active
      from mandys.saas_plans
      where is_active=true
      order by position asc
    `;
    const planModules = await tx<any[]>`
      select plan_key,module_key
      from mandys.saas_plan_modules
      order by plan_key,module_key
    `;
    const entitlements = await tx<any[]>`
      select module_key,status,activated_at,expires_at
      from mandys.module_entitlements
      where organization_id=${ctx.organizationId}
      order by module_key
    `;

    const subscription = subscriptionRows[0];
    if (!subscription) {
      return fail(404, "SUBSCRIPTION_NOT_FOUND", "Subscription record was not found");
    }

    return {
      body: {
        data: {
          subscription: {
            id: subscription.id,
            planKey: subscription.plan_key,
            planName: subscription.display_name,
            status: subscription.status,
            trialStartedAt: subscription.trial_started_at
              ? new Date(subscription.trial_started_at).toISOString()
              : null,
            trialEndsAt: subscription.trial_ends_at
              ? new Date(subscription.trial_ends_at).toISOString()
              : null,
            currentPeriodStartedAt: subscription.current_period_started_at
              ? new Date(subscription.current_period_started_at).toISOString()
              : null,
            currentPeriodEndsAt: subscription.current_period_ends_at
              ? new Date(subscription.current_period_ends_at).toISOString()
              : null,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            provider: subscription.provider,
            createdAt: new Date(subscription.created_at).toISOString(),
          },
          plans: plans.map((plan: any) => ({
            planKey: plan.plan_key,
            displayName: plan.display_name,
            position: plan.position,
            monthlyPriceCents: plan.monthly_price_cents,
            annualPriceCents: plan.annual_price_cents,
            currency: plan.currency,
            isPublic: plan.is_public,
            modules: planModules
              .filter((row: any) => row.plan_key === plan.plan_key)
              .map((row: any) => row.module_key),
          })),
          entitlements: entitlements.map((row: any) => ({
            moduleKey: row.module_key,
            status: row.status,
            // Preserve the existing API field name while reading the canonical
            // database column used by Mandy's entitlement schema.
            enabledAt: row.activated_at ? new Date(row.activated_at).toISOString() : null,
            expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          })),
        },
      },
    };
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-billing"))
  ) {
    return json({ ok: true, service: "mandys-billing" });
  }

  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);

    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    const result =
      request.method === "GET" && path === "/v1/billing"
        ? await billing(ctxOrError)
        : fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-billing error", error instanceof Error ? error.message : String(error));
    return json(
      { error: "INTERNAL_ERROR", message: "Subscription information could not be loaded" },
      500,
    );
  }
});
