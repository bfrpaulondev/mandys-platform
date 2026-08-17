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

type Context = {
  userId: string;
  email: string | null;
  organizationId: string;
  role: string;
};
type Result = { status?: number; body: unknown };
type BillingInterval = "month" | "year";

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
  const email = typeof body?.user?.email === "string" ? body.user.email : null;
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
  return { userId, email, organizationId, role };
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

function appendPriceData(
  body: URLSearchParams,
  index: number,
  options: {
    currency: string;
    unitAmount: number;
    interval: BillingInterval;
    name: string;
    quantity?: number;
    unitLabel?: string;
  },
) {
  const prefix = `line_items[${index}]`;
  body.set(`${prefix}[price_data][currency]`, options.currency.toLowerCase());
  body.set(`${prefix}[price_data][unit_amount]`, String(options.unitAmount));
  body.set(`${prefix}[price_data][recurring][interval]`, options.interval);
  body.set(`${prefix}[price_data][product_data][name]`, options.name);
  if (options.unitLabel) {
    body.set(`${prefix}[price_data][product_data][unit_label]`, options.unitLabel);
  }
  body.set(`${prefix}[quantity]`, String(options.quantity ?? 1));
}

async function checkout(ctx: Context, request: Request): Promise<Result> {
  if (ctx.role !== "owner") {
    return fail(403, "FORBIDDEN", "Only an organization owner can start checkout");
  }

  const payload = (await request.json().catch(() => null)) as {
    planKey?: unknown;
    interval?: unknown;
    locale?: unknown;
  } | null;
  const planKey = typeof payload?.planKey === "string" ? payload.planKey.trim() : "";
  const interval = payload?.interval === "year" ? "year" : payload?.interval === "month" ? "month" : null;
  const locale =
    typeof payload?.locale === "string" && /^(pt-PT|pt-BR|en|es)$/.test(payload.locale)
      ? payload.locale
      : "en";
  if (!planKey || !interval) {
    return fail(400, "INVALID_CHECKOUT_REQUEST", "A valid plan and billing interval are required");
  }

  const checkoutData = await sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    const locations = await tx<any[]>`
      select country_code
      from mandys.locations
      where organization_id=${ctx.organizationId} and is_active=true
      order by created_at asc
      limit 1
    `;
    const countryCode = locations[0]?.country_code;
    if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode)) {
      return { error: fail(409, "MARKET_NOT_CONFIGURED", "Restaurant country is not configured for billing") };
    }

    const prices = await tx<any[]>`
      select pp.plan_key,
             pp.country_code,
             pp.currency,
             pp.monthly_price_minor,
             pp.annual_price_minor,
             pp.included_staff,
             pp.extra_staff_monthly_minor,
             pp.is_public,
             pp.is_active,
             p.display_name
      from mandys.saas_plan_prices pp
      join mandys.saas_plans p on p.plan_key=pp.plan_key
      where pp.plan_key=${planKey}
        and pp.country_code=${countryCode}
        and pp.is_active=true
        and p.is_active=true
      limit 1
    `;
    const price = prices[0];
    if (!price) {
      return { error: fail(409, "MARKET_PRICE_UNAVAILABLE", "This plan is not priced for the restaurant market") };
    }
    // The first commercial lock lives in the database. Draft prices may exist
    // internally, but they can never reach Stripe until explicitly published.
    if (!price.is_public) {
      return { error: fail(409, "PRICING_NOT_PUBLIC", "Checkout is not available for this market yet") };
    }

    const unitAmount = interval === "year" ? price.annual_price_minor : price.monthly_price_minor;
    if (!Number.isInteger(unitAmount) || unitAmount < 0) {
      return { error: fail(409, "PRICE_NOT_READY", "The selected billing interval is not ready") };
    }

    const memberCountRows = await tx<{ count: number }[]>`
      select count(*)::int as count
      from mandys.member
      where organization_id=${ctx.organizationId}
    `;
    const activeStaff = memberCountRows[0]?.count ?? 0;
    const includedStaff = Number(price.included_staff ?? 0);
    const extraStaffCount = Math.max(0, activeStaff - includedStaff);
    const extraStaffMonthly = Number(price.extra_staff_monthly_minor ?? 0);
    const extraStaffUnitAmount = interval === "year" ? extraStaffMonthly * 10 : extraStaffMonthly;

    const subscriptions = await tx<any[]>`
      select provider_customer_id,provider_subscription_id,status
      from mandys.tenant_subscriptions
      where organization_id=${ctx.organizationId}
      limit 1
    `;

    return {
      price: {
        displayName: String(price.display_name),
        currency: String(price.currency),
        unitAmount,
        includedStaff,
        extraStaffCount,
        extraStaffUnitAmount,
      },
      subscription: subscriptions[0] ?? null,
    };
  });

  if ("error" in checkoutData) return checkoutData.error;

  // Provider and fiscal readiness are independent kill switches. Even if a
  // price is accidentally published, checkout still cannot call Stripe unless
  // production billing and automatic tax have both been explicitly enabled.
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const publicOrigin = Deno.env.get("MANDYS_BACKOFFICE_PUBLIC_ORIGIN");
  const liveReady = Deno.env.get("MANDYS_BILLING_LIVE_READY") === "true";
  const taxReady = Deno.env.get("MANDYS_STRIPE_AUTOMATIC_TAX_READY") === "true";
  if (!stripeSecretKey || !publicOrigin || !liveReady || !taxReady) {
    return fail(503, "BILLING_NOT_CONFIGURED", "Live subscription checkout is not configured");
  }

  const returnOrigin = publicOrigin.replace(/\/+$/, "");
  if (!/^https:\/\//.test(returnOrigin)) {
    return fail(503, "BILLING_NOT_CONFIGURED", "Billing return origin must use HTTPS");
  }

  const stripeBody = new URLSearchParams();
  stripeBody.set("mode", "subscription");
  stripeBody.set("success_url", `${returnOrigin}/${locale}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  stripeBody.set("cancel_url", `${returnOrigin}/${locale}/billing?checkout=cancelled`);
  stripeBody.set("automatic_tax[enabled]", "true");
  stripeBody.set("allow_promotion_codes", "true");
  stripeBody.set("metadata[mandys_organization_id]", ctx.organizationId);
  stripeBody.set("metadata[mandys_plan_key]", planKey);
  stripeBody.set("metadata[mandys_interval]", interval);
  stripeBody.set("subscription_data[metadata][mandys_organization_id]", ctx.organizationId);
  stripeBody.set("subscription_data[metadata][mandys_plan_key]", planKey);
  stripeBody.set("subscription_data[metadata][mandys_interval]", interval);

  const existingCustomer = checkoutData.subscription?.provider_customer_id;
  if (typeof existingCustomer === "string" && existingCustomer.startsWith("cus_")) {
    stripeBody.set("customer", existingCustomer);
  } else if (ctx.email) {
    stripeBody.set("customer_email", ctx.email);
  }

  appendPriceData(stripeBody, 0, {
    currency: checkoutData.price.currency,
    unitAmount: checkoutData.price.unitAmount,
    interval,
    name: `Mandy's ${checkoutData.price.displayName}`,
  });

  if (checkoutData.price.extraStaffCount > 0 && checkoutData.price.extraStaffUnitAmount > 0) {
    appendPriceData(stripeBody, 1, {
      currency: checkoutData.price.currency,
      unitAmount: checkoutData.price.extraStaffUnitAmount,
      interval,
      name: "Mandy's additional active staff",
      quantity: checkoutData.price.extraStaffCount,
      unitLabel: "staff",
    });
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: stripeBody,
  });
  const stripeResult = (await stripeResponse.json().catch(() => null)) as Record<string, any> | null;
  if (!stripeResponse.ok) {
    console.error("Stripe checkout error", stripeResponse.status, stripeResult?.error?.type ?? "unknown");
    return fail(502, "PAYMENT_PROVIDER_ERROR", "Subscription checkout could not be created");
  }
  const checkoutUrl = stripeResult?.url;
  const sessionId = stripeResult?.id;
  if (typeof checkoutUrl !== "string" || typeof sessionId !== "string") {
    return fail(502, "PAYMENT_PROVIDER_ERROR", "Subscription checkout returned an invalid response");
  }

  await sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await tx`
      insert into mandys.audit_logs (
        organization_id,actor_user_id,action,entity_type,entity_id,metadata
      ) values (
        ${ctx.organizationId},${ctx.userId},'billing.checkout_created','tenant_subscription',
        ${ctx.organizationId},${tx.json({ planKey, interval, sessionId })}
      )
    `;
  });

  return {
    body: {
      data: {
        checkoutUrl,
        sessionId,
      },
    },
  };
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
        : request.method === "POST" && path === "/v1/checkout"
          ? await checkout(ctxOrError, request)
          : fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-billing error", error instanceof Error ? error.message : String(error));
    return json(
      { error: "INTERNAL_ERROR", message: "Subscription operation could not be completed" },
      500,
    );
  }
});
