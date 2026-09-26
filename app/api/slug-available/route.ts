import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = await checkRateLimit("slug", getClientIp(request.headers));
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

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("slug_available", { p_slug: slug });
  if (error) {
    return NextResponse.json({ available: false }, { status: 502 });
  }
  return NextResponse.json({ available: data === true });
}
