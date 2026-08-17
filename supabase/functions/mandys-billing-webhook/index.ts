import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-billing-webhook-edge", search_path: "mandys,public" },
});

const supportedEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
const signatureToleranceSeconds = 300;
const maxPayloadBytes = 1_000_000;

type StripeEvent = { id?: unknown; type?: unknown; data?: { object?: Record<string, any> } };
type TenantResolution = {
  organizationId: string;
  planKey: string | null;
  subscriptionId: string | null;
  customerId: string | null;
};

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

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3).toLowerCase());
  if (!Number.isInteger(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > signatureToleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = hex(digest);
  return signatures.some((signature) => safeEqual(signature, expected));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function metadataValue(object: Record<string, any>, key: string): string | null {
  return stringValue(object.metadata?.[key]);
}

async function resolveTenant(eventType: string, object: Record<string, any>): Promise<TenantResolution | null> {
  const subscriptionId =
    eventType === "checkout.session.completed"
      ? stringValue(object.subscription)
      : eventType.startsWith("customer.subscription.")
        ? stringValue(object.id)
        : null;
  const customerId = stringValue(object.customer);
  let organizationId = metadataValue(object, "mandys_organization_id");
  let planKey = metadataValue(object, "mandys_plan_key");

  if (!organizationId && subscriptionId) {
    const rows = await sql<{ organization_id: string; plan_key: string }[]>`
      select organization_id,plan_key
      from mandys.tenant_subscriptions
      where provider='stripe' and provider_subscription_id=${subscriptionId}
      limit 1
    `;
    organizationId = rows[0]?.organization_id ?? null;
    planKey = planKey ?? rows[0]?.plan_key ?? null;
  }
  if (!organizationId) return null;

  const organizations = await sql<{ id: string }[]>`
    select id from mandys.organization where id=${organizationId} limit 1
  `;
  if (!organizations[0]) return null;
  if (planKey) {
    const plans = await sql<{ plan_key: string }[]>`
      select plan_key from mandys.saas_plans where plan_key=${planKey} and is_active=true limit 1
    `;
    if (!plans[0]) return null;
  }
  return { organizationId, planKey, subscriptionId, customerId };
}

function mandysStatus(stripeStatus: unknown): string {
  switch (stripeStatus) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "paused": return "paused";
    case "canceled": return "cancelled";
    default: return "incomplete";
  }
}

function unixDate(value: unknown): Date | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

function subscriptionPeriod(object: Record<string, any>) {
  const items = Array.isArray(object.items?.data) ? object.items.data : [];
  const starts = items
    .map((item: any) => item?.current_period_start)
    .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value));
  const ends = items
    .map((item: any) => item?.current_period_end)
    .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    start: starts.length > 0 ? unixDate(Math.min(...starts)) : null,
    end: ends.length > 0 ? unixDate(Math.max(...ends)) : null,
  };
}

async function recordEvent(eventId: string, eventType: string, resolution: TenantResolution, object: Record<string, any>) {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${resolution.organizationId},true)`;
    const inserted = await tx<{ id: string }[]>`
      insert into mandys.subscription_events (
        organization_id,event_type,provider,provider_event_id,metadata
      ) values (
        ${resolution.organizationId},${eventType},'stripe',${eventId},
        ${tx.json({
          planKey: resolution.planKey,
          subscriptionId: resolution.subscriptionId,
          customerId: resolution.customerId,
          stripeStatus: stringValue(object.status),
        })}
      )
      on conflict do nothing
      returning id
    `;
    if (!inserted[0]) return { duplicate: true };

    if (eventType === "checkout.session.completed") {
      await tx`
        update mandys.tenant_subscriptions
        set provider='stripe',
            provider_customer_id=coalesce(${resolution.customerId},provider_customer_id),
            provider_subscription_id=coalesce(${resolution.subscriptionId},provider_subscription_id),
            plan_key=coalesce(${resolution.planKey},plan_key),
            updated_at=now()
        where organization_id=${resolution.organizationId}
      `;
      return { duplicate: false };
    }

    const period = subscriptionPeriod(object);
    const status = mandysStatus(object.status);
    await tx`
      update mandys.tenant_subscriptions
      set provider='stripe',
          provider_customer_id=coalesce(${resolution.customerId},provider_customer_id),
          provider_subscription_id=coalesce(${resolution.subscriptionId},provider_subscription_id),
          plan_key=coalesce(${resolution.planKey},plan_key),
          status=${status},
          current_period_started_at=${period.start},
          current_period_ends_at=${period.end},
          cancel_at_period_end=${object.cancel_at_period_end === true},
          updated_at=now()
      where organization_id=${resolution.organizationId}
    `;
    return { duplicate: false };
  });
}

Deno.serve(async (request) => {
  if (request.method === "GET") {
    return json({
      ok: true,
      service: "mandys-billing-webhook",
      configured: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")),
      liveReady: Deno.env.get("MANDYS_BILLING_LIVE_READY") === "true",
    });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const liveReady = Deno.env.get("MANDYS_BILLING_LIVE_READY") === "true";
  if (!webhookSecret || !liveReady) {
    return json({ error: "BILLING_NOT_CONFIGURED", message: "Stripe webhook processing is not enabled" }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxPayloadBytes) {
    return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "INVALID_SIGNATURE" }, 400);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }
  if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
    return json({ error: "INVALID_SIGNATURE" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: "INVALID_EVENT" }, 400);
  }
  const eventId = stringValue(event.id);
  const eventType = stringValue(event.type);
  const object = event.data?.object;
  if (!eventId || !eventType || !object) return json({ error: "INVALID_EVENT" }, 400);
  if (!supportedEvents.has(eventType)) return json({ received: true, ignored: true });

  const resolution = await resolveTenant(eventType, object);
  if (!resolution) {
    console.error("Stripe billing event could not resolve a Mandy's tenant", eventType, eventId);
    return json({ received: true, ignored: true, reason: "TENANT_NOT_RESOLVED" });
  }

  try {
    const result = await recordEvent(eventId, eventType, resolution, object);
    return json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error(
      "mandys-billing-webhook processing error",
      eventType,
      eventId,
      error instanceof Error ? error.message : String(error),
    );
    return json({ error: "WEBHOOK_PROCESSING_FAILED" }, 500);
  }
});
