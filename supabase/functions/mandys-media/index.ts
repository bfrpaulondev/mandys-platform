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
  connection: { application_name: "mandys-media-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };
type MediaKind = "logo" | "cover" | "menu-item";

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

async function requestContext(request: Request): Promise<Context | Result> {
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

  const rows = await sql<{ role: string }[]>`
    select role
    from mandys.member
    where organization_id=${organizationId} and user_id=${userId}
    limit 1
  `;
  const role = rows[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digest(algorithm: "SHA-1" | "SHA-256", value: string) {
  const bytes = new TextEncoder().encode(value);
  return hex(await crypto.subtle.digest(algorithm, bytes));
}

function isMediaKind(value: unknown): value is MediaKind {
  return value === "logo" || value === "cover" || value === "menu-item";
}

async function createUploadSignature(ctx: Context, request: Request): Promise<Result> {
  if (!new Set(["owner", "manager"]).has(ctx.role)) {
    return fail(403, "FORBIDDEN", "Only an owner or manager can upload restaurant media");
  }

  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  const uploadPreset = Deno.env.get("CLOUDINARY_UPLOAD_PRESET");
  if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
    return fail(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Restaurant media upload is not configured for this environment",
    );
  }

  const body = (await request.json().catch(() => null)) as { kind?: unknown } | null;
  if (!isMediaKind(body?.kind)) {
    return fail(400, "INVALID_MEDIA_KIND", "Media kind must be logo, cover or menu-item");
  }

  const tenantHash = (await digest("SHA-256", ctx.organizationId)).slice(0, 20);
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `mandys/tenant-${tenantHash}/${body.kind}`;
  const signedParameters = {
    folder,
    timestamp: String(timestamp),
    upload_preset: uploadPreset,
  };
  const signatureInput = Object.entries(signedParameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signature = await digest("SHA-1", `${signatureInput}${apiSecret}`);

  await sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await tx`
      insert into mandys.audit_logs (
        organization_id, actor_user_id, action, entity_type, entity_id, metadata
      ) values (
        ${ctx.organizationId}, ${ctx.userId}, 'media.upload_signature_created',
        'organization', ${ctx.organizationId}, ${tx.json({ kind: body.kind, folder })}
      )
    `;
  });

  return {
    body: {
      data: {
        cloudName,
        apiKey,
        timestamp,
        folder,
        uploadPreset,
        signature,
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
        maxClientFileBytes: 10_000_000,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    },
  };
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-media"))
  ) {
    return json({
      ok: true,
      service: "mandys-media",
      configured: Boolean(
        Deno.env.get("CLOUDINARY_CLOUD_NAME") &&
          Deno.env.get("CLOUDINARY_API_KEY") &&
          Deno.env.get("CLOUDINARY_API_SECRET") &&
          Deno.env.get("CLOUDINARY_UPLOAD_PRESET"),
      ),
    });
  }

  try {
    const ctxOrError = await requestContext(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);

    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    const result =
      request.method === "POST" && path === "/v1/signature"
        ? await createUploadSignature(ctxOrError, request)
        : fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-media error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Media upload could not be prepared" }, 500);
  }
});
