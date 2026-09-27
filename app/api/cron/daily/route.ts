import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { expireTrials, resetMonthlyQuotes, sweepR2Orphans } from "@/lib/daily-cron";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Margen para responder antes de que Vercel corte la función en `maxDuration`. */
const BUDGET_MS = 240_000;

type JobResult = { ok: true; result: unknown } | { ok: false; error: string };

async function run(name: string, job: () => Promise<unknown>): Promise<JobResult> {
  try {
    return { ok: true, result: await job() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`cron daily: ${name} falló`, message);
    return { ok: false, error: message };
  }
}

/**
 * Cron diario (T17, `vercel.json`): vence pruebas, reinicia el contador mensual de cotizaciones y
 * limpia huérfanos de R2. Idempotente: se puede correr a mano las veces que sea
 * (`curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/daily`).
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const deadline = Date.now() + BUDGET_MS;
  const trials = await run("expireTrials", expireTrials);
  const quotes = await run("resetMonthlyQuotes", resetMonthlyQuotes);
  const r2 = await run("sweepR2Orphans", () => sweepR2Orphans({ deadline }));

  const ok = trials.ok && quotes.ok && r2.ok;
  return NextResponse.json({ ok, trials, quotes, r2 }, { status: ok ? 200 : 500 });
}
