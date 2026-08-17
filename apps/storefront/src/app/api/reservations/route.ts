import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { normalizeStorefrontHost, resolveStorefrontHostname } from "../../../lib/public-api";

const PUBLIC_RESERVATIONS_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public-reservations";

export const dynamic = "force-dynamic";

async function resolveHostname() {
  const requestHeaders = await headers();
  const forwardedHost = normalizeStorefrontHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeStorefrontHost(requestHeaders.get("host"));
  return resolveStorefrontHostname(host);
}

export async function GET(request: Request) {
  const hostname = await resolveHostname();
  if (!hostname) return NextResponse.json({ error: "HOST_UNAVAILABLE", message: "Restaurant hostname could not be resolved" }, { status: 400 });
  const incoming = new URL(request.url);
  const date = incoming.searchParams.get("date");
  const partySize = incoming.searchParams.get("partySize") ?? "2";
  if (!date) return NextResponse.json({ error: "INVALID_QUERY", message: "Reservation date is required" }, { status: 400 });

  const target = new URL(`${PUBLIC_RESERVATIONS_UPSTREAM}/v1/public/availability`);
  target.searchParams.set("hostname", hostname);
  target.searchParams.set("date", date);
  target.searchParams.set("partySize", partySize);
  try {
    const response = await fetch(target, { cache: "no-store", headers: { accept: "application/json" } });
    const responseBody = await response.json().catch(() => ({ error: "UPSTREAM_ERROR", message: "Availability service returned an invalid response" }));
    return NextResponse.json(responseBody, { status: response.status });
  } catch {
    return NextResponse.json({ error: "API_UNAVAILABLE", message: "Availability service is temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const hostname = await resolveHostname();
  if (!hostname) return NextResponse.json({ error: "HOST_UNAVAILABLE", message: "Restaurant hostname could not be resolved" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID_REQUEST", message: "Reservation data is invalid" }, { status: 400 });

  try {
    const response = await fetch(`${PUBLIC_RESERVATIONS_UPSTREAM}/v1/public/reservations`, {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ ...body, hostname }),
    });
    const responseBody = await response.json().catch(() => ({ error: "UPSTREAM_ERROR", message: "Reservation service returned an invalid response" }));
    return NextResponse.json(responseBody, { status: response.status });
  } catch {
    return NextResponse.json({ error: "API_UNAVAILABLE", message: "Reservation service is temporarily unavailable" }, { status: 503 });
  }
}
