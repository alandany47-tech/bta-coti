import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { headObject, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";

type CheckResult = "ok" | "skipped" | { error: string };

async function checkSupabase(): Promise<CheckResult> {
  const { error } = await createServerSupabaseClient().from("plans").select("id").limit(1);
  return error ? { error: error.message } : "ok";
}

async function checkR2(): Promise<CheckResult> {
  if (!r2Configured()) return "skipped";
  const key = process.env.R2_HEALTH_KEY ?? "health/ping.txt";
  try {
    const object = await headObject(key);
    return object ? "ok" : { error: `objeto "${key}" no existe en el bucket` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "error desconocido" };
  }
}

/**
 * Monitor de uptime (docs/MONITORING.md §1). Consulta Supabase y hace HEAD a un objeto fijo en R2
 * (súbelo una vez con la llave de `R2_HEALTH_KEY`, por defecto `health/ping.txt`); Stripe (T20)
 * queda pendiente de agregarse aquí cuando exista. Sin `HEALTH_CHECK_TOKEN` configurado, la ruta
 * no responde para no quedar abierta a cualquiera por accidente en un entorno mal configurado.
 */
export async function GET(request: Request) {
  const token = process.env.HEALTH_CHECK_TOKEN;
  if (!token || request.headers.get("x-health-token") !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [supabase, r2] = await Promise.all([checkSupabase(), checkR2()]);
  const checks = { supabase, r2 };
  const ok = Object.values(checks).every((check) => check === "ok" || check === "skipped");

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
