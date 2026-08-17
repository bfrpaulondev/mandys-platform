import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  normalizeStorefrontHost,
  resolveStorefrontHostname,
} from "../../../../lib/public-api";

const PUBLIC_RESERVATIONS_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public-reservations";

export const dynamic = "force-dynamic";

async function resolveHostname() {
  const requestHeaders = await headers();
  const forwardedHost = normalizeStorefrontHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeStorefrontHost(requestHeaders.get("host"));
  return resolveStorefrontHostname(host);
}

export async function POST(request: Request) {
  const hostname = await resolveHostname();
  if (!hostname) {
    return NextResponse.json(
      { error: "HOST_UNAVAILABLE", message: "Restaurant hostname could not be resolved" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Waitlist data is invalid" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${PUBLIC_RESERVATIONS_UPSTREAM}/v1/public/waitlist`, {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, hostname }),
    });
    const responseBody = await response.json().catch(() => ({
      error: "UPSTREAM_ERROR",
      message: "Waitlist service returned an invalid response",
    }));
    return NextResponse.json(responseBody, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "API_UNAVAILABLE", message: "Waitlist service is temporarily unavailable" },
      { status: 503 },
    );
  }
}
