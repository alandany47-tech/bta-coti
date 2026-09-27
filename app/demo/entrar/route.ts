import { NextResponse } from "next/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { originFromHeaders, tenantOrigin } from "@/lib/auth/redirects";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * "Probar el panel" sin registro (docs/DEMO.md §2): entra con la sesión compartida del usuario
 * demo `editor` de `demo-broker` (la vitrina principal, "Residencial Almendro"). La contraseña
 * vive en `DEMO_PASSWORD` — la misma que usa `reset_demo_data` al recrear los tenants de demo.
 */
const DEMO_TENANT_SLUG = "demo-broker";
const DEMO_EDITOR_EMAIL = "editor.broker@demo.ayx.test";

export async function GET(request: Request) {
  const origin = originFromHeaders(request.headers);
  const host = request.headers.get("host") ?? "";

  const limit = await checkRateLimit("demo", getClientIp(request.headers));
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/?error=demo_ocupada", origin));
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "La demo no está configurada." }, { status: 503 });
  }

  const supabase = await createSessionSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EDITOR_EMAIL, password });
  if (error) {
    return NextResponse.json({ error: "La demo no está disponible en este momento." }, { status: 503 });
  }

  const url = new URL(request.url);
  return NextResponse.redirect(`${tenantOrigin(DEMO_TENANT_SLUG, host)}/panel${url.searchParams.get("present") ? "?present=1" : ""}`);
}
