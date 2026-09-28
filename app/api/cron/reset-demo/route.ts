import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/demo";
import { pingHeartbeat } from "@/lib/heartbeat";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await resetDemoData();
  if (!result.ok) {
    console.error("cron reset-demo falló", result.error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  await pingHeartbeat(process.env.HEARTBEAT_URL_RESET_DEMO);
  return NextResponse.json({ ok: true });
}
