import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncDisposableDomains } from "@/lib/disposable-domains";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const total = await syncDisposableDomains(createServiceRoleClient());
    return NextResponse.json({ ok: true, total });
  } catch (error) {
    console.error("cron disposable-domains falló", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
