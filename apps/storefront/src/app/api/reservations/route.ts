import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(",")[0]?.trim().toLowerCase().split(":")[0];
  return host || null;
}

export async function POST(request: Request) {
  const apiUrl = process.env.MANDYS_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: "API_UNAVAILABLE", message: "Reservations are not connected in this environment" },
      { status: 503 },
    );
  }

  const requestHeaders = await headers();
  const forwardedHost = normalizeHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeHost(requestHeaders.get("host"));
  const configuredHostname = normalizeHost(process.env.MANDYS_STOREFRONT_HOSTNAME ?? null);
  const hostname = configuredHostname ?? host;

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
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/public/reservations`, {
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
