import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      service: "mandys-backoffice",
      status: "ok",
      readinessVersion: "authenticated-lifecycle-v1",
      performanceVersion: "perf-6-10-stable-v1",
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
