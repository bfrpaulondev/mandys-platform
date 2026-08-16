import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  getPublicApiUrl,
  normalizeStorefrontHost,
  resolveStorefrontHostname,
} from "../../../lib/public-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiUrl = getPublicApiUrl();

  const requestHeaders = await headers();
  const forwardedHost = normalizeStorefrontHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeStorefrontHost(requestHeaders.get("host"));
  const hostname = resolveStorefrontHostname(host);

  if (!hostname) {
    return NextResponse.json(
      { error: "HOST_UNAVAILABLE", message: "Restaurant hostname could not be resolved" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Reservation data is invalid" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${apiUrl}/v1/public/reservations`, {
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
      message: "Reservation service returned an invalid response",
    }));

    return NextResponse.json(responseBody, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "API_UNAVAILABLE", message: "Reservation service is temporarily unavailable" },
      { status: 503 },
    );
  }
}
