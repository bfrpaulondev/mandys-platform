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
  connection: { application_name: "mandys-billing-portal-edge", search_path: "mandys,public" },
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
    select role from mandys.member
    where organization_id=${organizationId} and user_id=${userId}
    limit 1
  `;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

async function createPortal(ctx: Context, request: Request): Promise<Result> {
  if (ctx.role !== "owner") {
    return fail(403, "FORBIDDEN", "Only an organization owner can manage the billing account");
  }

  const payload = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale =
    typeof payload?.locale === "string" && /^(pt-PT|pt-BR|en|es)$/.test(payload.locale)
      ? payload.locale
      : "en";

  const subscriptionRows = await sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    return tx<{ provider: string | null; provider_customer_id: string | null }[]>`
      select provider,provider_customer_id
      from mandys.tenant_subscriptions
      where organization_id=${ctx.organizationId}
      limit 1
    `;
  });
  const subscription = subscriptionRows[0];
  if (
    subscription?.provider !== "stripe" ||
    typeof subscription.provider_customer_id !== "string" ||
    !subscription.provider_customer_id.startsWith("cus_")
  ) {
    return fail(409, "BILLING_CUSTOMER_NOT_READY", "A Stripe billing customer is not linked yet");
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const publicOrigin = Deno.env.get("MANDYS_BACKOFFICE_PUBLIC_ORIGIN");
  const liveReady = Deno.env.get("MANDYS_BILLING_LIVE_READY") === "true";
  if (!stripeSecretKey || !publicOrigin || !liveReady) {
    return fail(503, "BILLING_NOT_CONFIGURED", "Live billing management is not configured");
  }

  const returnOrigin = publicOrigin.replace(/\/+$/, "");
  if (!/^https:\/\//.test(returnOrigin)) {
    return fail(503, "BILLING_NOT_CONFIGURED", "Billing return origin must use HTTPS");
  }

  const stripeBody = new URLSearchParams();
  stripeBody.set("customer", subscription.provider_customer_id);
  stripeBody.set("return_url", `${returnOrigin}/${locale}/billing`);
  const portalConfiguration = Deno.env.get("STRIPE_BILLING_PORTAL_CONFIGURATION_ID");
  if (portalConfiguration?.startsWith("bpc_")) {
    stripeBody.set("configuration", portalConfiguration);
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: stripeBody,
  });
  const stripeResult = (await stripeResponse.json().catch(() => null)) as Record<string, any> | null;
  if (!stripeResponse.ok) {
    console.error("Stripe billing portal error", stripeResponse.status, stripeResult?.error?.type ?? "unknown");
    return fail(502, "PAYMENT_PROVIDER_ERROR", "Billing portal could not be created");
  }
  const portalUrl = stripeResult?.url;
  const portalSessionId = stripeResult?.id;
  if (typeof portalUrl !== "string" || typeof portalSessionId !== "string") {
    return fail(502, "PAYMENT_PROVIDER_ERROR", "Billing portal returned an invalid response");
  }

  await sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await tx`
      insert into mandys.audit_logs (
        organization_id,actor_user_id,action,entity_type,entity_id,metadata
      ) values (
        ${ctx.organizationId},${ctx.userId},'billing.portal_created','tenant_subscription',
        ${ctx.organizationId},${tx.json({ portalSessionId })}
      )
    `;
  });

  return { body: { data: { portalUrl } } };
}

Deno.serve(async (request) => {
  if (request.method === "GET") {
    return json({
      ok: true,
      service: "mandys-billing-portal",
      configured: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
      liveReady: Deno.env.get("MANDYS_BILLING_LIVE_READY") === "true",
    });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const result = await createPortal(ctxOrError, request);
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-billing-portal error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Billing portal could not be processed" }, 500);
  }
});
