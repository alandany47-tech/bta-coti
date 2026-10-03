import { NextResponse } from "next/server";
import { expirePastDue, expireTrials } from "@/lib/trials";
import { resetMonthlyQuoteCounters } from "@/lib/monthly-usage";
import { cleanupOrphanedMedia } from "@/lib/media-cleanup";
import { pingHeartbeat } from "@/lib/heartbeat";
import { sendTrialEmails } from "@/lib/email/notify";

export const runtime = "nodejs";

/** T17: vence pruebas, resetea el contador mensual de cotizaciones y limpia medios huérfanos.
 *  T20: también suspende cuentas con más de 7 días en past_due (Stripe no manda webhook para eso). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const expiredTrials = await expireTrials();
    const expiredPastDue = await expirePastDue();
    const resetUsageRows = await resetMonthlyQuoteCounters();
    const media = await cleanupOrphanedMedia();
    // T25: avisos de la prueba (día 5, día 7, vencida). Van después de expireTrials() para cubrir las vencidas de hoy.
    const emails = await sendTrialEmails();
    await pingHeartbeat(process.env.HEARTBEAT_URL_DAILY);
    return NextResponse.json({
      ok: true,
      expiredTrials: expiredTrials.length,
      expiredPastDue: expiredPastDue.length,
      resetUsageRows,
      emails,
      ...media,
    });
  } catch (error) {
    console.error("cron daily falló", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
