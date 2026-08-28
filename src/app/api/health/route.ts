import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      checks: { application: "ok", database: "ok" },
      responseTimeMs: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { application: "ok", database: "unavailable" },
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
