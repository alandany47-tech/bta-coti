import { NextResponse } from "next/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { originFromHeaders, safeNext } from "@/lib/auth/redirects";

export async function POST(request: Request) {
  const supabase = await createSessionSupabaseClient();
  await supabase.auth.signOut();
  // `next` (p. ej. /invitacion/<token>) pasa por safeNext: solo rutas propias.
  const form = await request.formData().catch(() => null);
  const next = safeNext(typeof form?.get("next") === "string" ? String(form?.get("next")) : null, request.headers.get("host") ?? "");
  const login = new URL("/login", originFromHeaders(request.headers));
  if (next) login.searchParams.set("next", next);
  return NextResponse.redirect(login, 303);
}
