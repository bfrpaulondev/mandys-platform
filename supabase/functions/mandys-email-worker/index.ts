import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-email-worker-edge", search_path: "mandys,public" },
});

const batchSize = 5;
const staleLockMinutes = 10;

type OutboxRow = {
  id: string;
  organization_id: string;
  template_key: string;
  locale: string;
  recipient_email: string;
  reply_to_email: string | null;
  payload: Record<string, unknown>;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
};

type RenderedEmail = { subject: string; text: string; html: string };

type DeliveryResult =
  | { kind: "sent"; providerMessageId: string }
  | { kind: "retry"; errorCode: string; delaySeconds: number }
  | { kind: "failed"; errorCode: string };

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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localeTag(locale: string) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "es") return "es-ES";
  if (locale === "en") return "en-GB";
  return "pt-PT";
}

function formatDateTime(value: unknown, locale: string, timezone: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(localeTag(locale), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: typeof timezone === "string" ? timezone : "Europe/Lisbon",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(localeTag(locale), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
}

function formatDate(value: unknown, locale: string) {
  if (typeof value !== "string") return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function templateCopy(locale: string) {
  if (locale === "pt-BR") {
    return {
      hello: "Olá",
      reservationSubject: "Recebemos seu pedido de reserva",
      reservationBody: "Recebemos seu pedido de reserva. A equipe do restaurante fará o acompanhamento conforme necessário.",
      dateTime: "Data e horário",
      party: "Pessoas",
      waitlistSubject: "Recebemos seu pedido para a lista de espera",
      waitlistBody: "Recebemos seu pedido para a lista de espera. Isso ainda não é uma reserva confirmada.",
      requestedDate: "Data solicitada",
      orderSubject: "Recebemos seu pedido",
      orderBody: "Recebemos seu pedido e o restaurante fará o acompanhamento do preparo e da retirada.",
      orderNumber: "Pedido",
      eventSubject: "Recebemos seu pedido de evento",
      eventBody: "Recebemos os detalhes do seu pedido de evento. A equipe entrará em contato para continuar o atendimento.",
      eventDate: "Data do evento",
      eventType: "Tipo de evento",
      footer: "Mensagem transacional enviada pelo Mandy's em nome do restaurante.",
    };
  }
  if (locale === "es") {
    return {
      hello: "Hola",
      reservationSubject: "Hemos recibido tu solicitud de reserva",
      reservationBody: "Hemos recibido tu solicitud de reserva. El equipo del restaurante hará el seguimiento cuando sea necesario.",
      dateTime: "Fecha y hora",
      party: "Personas",
      waitlistSubject: "Hemos recibido tu solicitud para la lista de espera",
      waitlistBody: "Hemos recibido tu solicitud para la lista de espera. Esto todavía no es una reserva confirmada.",
      requestedDate: "Fecha solicitada",
      orderSubject: "Hemos recibido tu pedido",
      orderBody: "Hemos recibido tu pedido y el restaurante hará el seguimiento de la preparación y recogida.",
      orderNumber: "Pedido",
      eventSubject: "Hemos recibido tu solicitud de evento",
      eventBody: "Hemos recibido los detalles de tu solicitud de evento. El equipo se pondrá en contacto para continuar.",
      eventDate: "Fecha del evento",
      eventType: "Tipo de evento",
      footer: "Mensaje transaccional enviado por Mandy's en nombre del restaurante.",
    };
  }
  if (locale === "en") {
    return {
      hello: "Hello",
      reservationSubject: "We received your reservation request",
      reservationBody: "We received your reservation request. The restaurant team will follow up when needed.",
      dateTime: "Date and time",
      party: "Guests",
      waitlistSubject: "We received your waitlist request",
      waitlistBody: "We received your waitlist request. This is not yet a confirmed reservation.",
      requestedDate: "Requested date",
      orderSubject: "We received your order",
      orderBody: "We received your order and the restaurant will follow up on preparation and collection.",
      orderNumber: "Order",
      eventSubject: "We received your event enquiry",
      eventBody: "We received the details of your event enquiry. The team will get in touch to continue.",
      eventDate: "Event date",
      eventType: "Event type",
      footer: "Transactional message sent by Mandy's on behalf of the restaurant.",
    };
  }
  return {
    hello: "Olá",
    reservationSubject: "Recebemos o seu pedido de reserva",
    reservationBody: "Recebemos o seu pedido de reserva. A equipa do restaurante fará o acompanhamento quando necessário.",
    dateTime: "Data e hora",
    party: "Pessoas",
    waitlistSubject: "Recebemos o seu pedido para a lista de espera",
    waitlistBody: "Recebemos o seu pedido para a lista de espera. Isto ainda não é uma reserva confirmada.",
    requestedDate: "Data pedida",
    orderSubject: "Recebemos o seu pedido",
    orderBody: "Recebemos o seu pedido e o restaurante fará o acompanhamento da preparação e recolha.",
    orderNumber: "Pedido",
    eventSubject: "Recebemos o seu pedido de evento",
    eventBody: "Recebemos os detalhes do seu pedido de evento. A equipa entrará em contacto para continuar.",
    eventDate: "Data do evento",
    eventType: "Tipo de evento",
    footer: "Mensagem transacional enviada pelo Mandy's em nome do restaurante.",
  };
}

function render(row: OutboxRow): RenderedEmail | null {
  const copy = templateCopy(row.locale);
  const p = row.payload ?? {};
  const restaurant = String(p.restaurantName ?? "Mandy's");
  const name = String(p.guestName ?? "").trim();
  const greeting = name ? `${copy.hello}, ${name}.` : `${copy.hello}.`;
  const details: Array<[string, string]> = [];
  let subject = "";
  let body = "";

  if (row.template_key === "reservation_received") {
    subject = `${copy.reservationSubject} — ${restaurant}`;
    body = copy.reservationBody;
    const when = formatDateTime(p.startsAt, row.locale, p.timezone);
    if (when) details.push([copy.dateTime, when]);
    if (p.partySize !== undefined) details.push([copy.party, String(p.partySize)]);
  } else if (row.template_key === "waitlist_received") {
    subject = `${copy.waitlistSubject} — ${restaurant}`;
    body = copy.waitlistBody;
    const date = formatDate(p.requestedDate, row.locale);
    if (date) details.push([copy.requestedDate, date]);
    if (p.partySize !== undefined) details.push([copy.party, String(p.partySize)]);
  } else if (row.template_key === "order_received") {
    subject = `${copy.orderSubject} — ${restaurant}`;
    body = copy.orderBody;
    if (p.orderNumber !== undefined) details.push([copy.orderNumber, `#${String(p.orderNumber)}`]);
  } else if (row.template_key === "event_inquiry_received") {
    subject = `${copy.eventSubject} — ${restaurant}`;
    body = copy.eventBody;
    const when = formatDateTime(p.eventAt, row.locale, p.timezone);
    if (when) details.push([copy.eventDate, when]);
    if (p.eventType) details.push([copy.eventType, String(p.eventType)]);
    if (p.partySize !== undefined) details.push([copy.party, String(p.partySize)]);
  } else {
    return null;
  }

  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
  const text = `${greeting}\n\n${body}${textDetails ? `\n\n${textDetails}` : ""}\n\n${copy.footer}`;
  const htmlDetails = details.length
    ? `<dl>${details.map(([label, value]) => `<dt style="font-weight:600;margin-top:12px">${escapeHtml(label)}</dt><dd style="margin:2px 0 0">${escapeHtml(value)}</dd>`).join("")}</dl>`
    : "";
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#171717;max-width:620px"><p>${escapeHtml(greeting)}</p><p>${escapeHtml(body)}</p>${htmlDetails}<p style="margin-top:28px;font-size:12px;color:#666">${escapeHtml(copy.footer)}</p></div>`;
  return { subject, text, html };
}

async function claim(): Promise<OutboxRow[]> {
  return sql.begin(async (tx) => {
    return tx<OutboxRow[]>`
      with candidates as (
        select id
        from mandys.transactional_email_outbox
        where (
          status='pending'
          or (status='processing' and locked_at < now() - (${staleLockMinutes} || ' minutes')::interval)
        )
          and available_at <= now()
          and attempts < max_attempts
        order by available_at asc,created_at asc
        for update skip locked
        limit ${batchSize}
      )
      update mandys.transactional_email_outbox o
      set status='processing',
          attempts=o.attempts+1,
          locked_at=now(),
          updated_at=now()
      from candidates c
      where o.id=c.id
      returning o.id,o.organization_id,o.template_key,o.locale::text,o.recipient_email,
                o.reply_to_email,o.payload,o.idempotency_key,o.attempts,o.max_attempts
    `;
  });
}

async function markSent(row: OutboxRow, providerMessageId: string) {
  await sql`
    update mandys.transactional_email_outbox
    set status='sent',provider='resend',provider_message_id=${providerMessageId},
        sent_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=${row.id}
  `;
}

async function markRetry(row: OutboxRow, errorCode: string, delaySeconds: number) {
  const exhausted = row.attempts >= row.max_attempts;
  await sql`
    update mandys.transactional_email_outbox
    set status=${exhausted ? "failed" : "pending"},
        available_at=case when ${exhausted} then available_at else now() + (${Math.max(1, delaySeconds)} || ' seconds')::interval end,
        locked_at=null,last_error_code=${errorCode},updated_at=now()
    where id=${row.id}
  `;
}

async function markFailed(row: OutboxRow, errorCode: string) {
  await sql`
    update mandys.transactional_email_outbox
    set status='failed',locked_at=null,last_error_code=${errorCode},updated_at=now()
    where id=${row.id}
  `;
}

function retryDelay(attempt: number) {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
}

async function deliver(row: OutboxRow, rendered: RenderedEmail, config: { apiKey: string; from: string }): Promise<DeliveryResult> {
  const payload: Record<string, unknown> = {
    from: config.from,
    to: [row.recipient_email],
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  };
  if (row.reply_to_email) payload.reply_to = row.reply_to_email;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": row.idempotency_key,
        "user-agent": "mandys-email-worker/1.0",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { kind: "retry", errorCode: "PROVIDER_NETWORK_ERROR", delaySeconds: retryDelay(row.attempts) };
  }

  const body = (await response.json().catch(() => null)) as Record<string, any> | null;
  if (response.ok && typeof body?.id === "string") {
    return { kind: "sent", providerMessageId: body.id };
  }

  const providerType = typeof body?.name === "string" ? body.name : typeof body?.type === "string" ? body.type : `HTTP_${response.status}`;
  const errorCode = `RESEND_${providerType}`.slice(0, 120);
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      kind: "retry",
      errorCode,
      delaySeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : retryDelay(row.attempts),
    };
  }
  if (response.status >= 500 || providerType === "concurrent_idempotent_requests") {
    return { kind: "retry", errorCode, delaySeconds: retryDelay(row.attempts) };
  }
  return { kind: "failed", errorCode };
}

Deno.serve(async (request) => {
  if (request.method === "GET") {
    return json({
      ok: true,
      service: "mandys-email-worker",
      configured: Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("MANDYS_EMAIL_FROM")),
      providerReady: Deno.env.get("MANDYS_EMAIL_PROVIDER_READY") === "true",
    });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const workerToken = Deno.env.get("MANDYS_EMAIL_WORKER_TOKEN");
  const authorization = request.headers.get("authorization");
  if (!workerToken || authorization !== `Bearer ${workerToken}`) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MANDYS_EMAIL_FROM");
  const providerReady = Deno.env.get("MANDYS_EMAIL_PROVIDER_READY") === "true";
  if (!apiKey || !from || !providerReady) {
    return json({ error: "EMAIL_PROVIDER_NOT_CONFIGURED", message: "Transactional email delivery is disabled" }, 503);
  }

  const rows = await claim();
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const row of rows) {
    const rendered = render(row);
    if (!rendered) {
      await markFailed(row, "TEMPLATE_UNSUPPORTED");
      failed += 1;
      continue;
    }
    const result = await deliver(row, rendered, { apiKey, from });
    if (result.kind === "sent") {
      await markSent(row, result.providerMessageId);
      sent += 1;
    } else if (result.kind === "retry") {
      await markRetry(row, result.errorCode, result.delaySeconds);
      retried += 1;
    } else {
      await markFailed(row, result.errorCode);
      failed += 1;
    }
  }

  return json({ data: { claimed: rows.length, sent, retried, failed } });
});
