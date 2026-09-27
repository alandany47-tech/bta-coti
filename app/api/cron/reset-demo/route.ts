import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { resetDemoData } from "@/lib/demo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await resetDemoData();
  if (!result.ok) {
    console.error("cron reset-demo falló", result.error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
