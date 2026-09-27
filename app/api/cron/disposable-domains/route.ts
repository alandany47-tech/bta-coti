import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncDisposableDomains } from "@/lib/disposable-domains";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
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
