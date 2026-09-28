import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit("slug", ip);
  if (!limit.ok) {
    return NextResponse.json(
      { available: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (slug.length < 3 || slug.length > 30) {
    return NextResponse.json({ available: false });
  }

  // Service role a propósito: Upstash (arriba) ya limita por IP real; el límite en la base es
  // solo el respaldo para quien se salte la app, y se salta a sí mismo con la llave de servicio.
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("slug_available", { p_slug: slug });
  if (error) {
    return NextResponse.json({ available: false }, { status: 502 });
  }
  return NextResponse.json({ available: data === true });
}
