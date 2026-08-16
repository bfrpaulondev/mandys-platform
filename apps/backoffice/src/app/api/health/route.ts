import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      service: "mandys-backoffice",
      status: "ok",
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
