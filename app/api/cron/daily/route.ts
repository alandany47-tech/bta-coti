import { NextResponse } from "next/server";
import { expireTrials } from "@/lib/trials";
import { resetMonthlyQuoteCounters } from "@/lib/monthly-usage";
import { cleanupOrphanedMedia } from "@/lib/media-cleanup";
import { pingHeartbeat } from "@/lib/heartbeat";

export const runtime = "nodejs";

/** T17: vence pruebas, resetea el contador mensual de cotizaciones y limpia medios huérfanos. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const expiredTrials = await expireTrials();
    const resetUsageRows = await resetMonthlyQuoteCounters();
    const media = await cleanupOrphanedMedia();
    await pingHeartbeat(process.env.HEARTBEAT_URL_DAILY);
    return NextResponse.json({ ok: true, expiredTrials: expiredTrials.length, resetUsageRows, ...media });
  } catch (error) {
    console.error("cron daily falló", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
