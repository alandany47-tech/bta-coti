import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/auth/destination";
import { originFromHeaders, tenantOrigin } from "@/lib/auth/redirects";
import { provisionPendingTenant } from "@/lib/auth/provision";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = originFromHeaders(request.headers);
  const host = request.headers.get("host") ?? "";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");

  const supabase = await createSessionSupabaseClient();
  let failed = true;

  if (code) {
    failed = Boolean((await supabase.auth.exchangeCodeForSession(code)).error);
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    failed = Boolean((await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error);
  }

  if (failed) return NextResponse.redirect(new URL("/login?error=enlace_invalido", origin));

  // Registro (T04): si el usuario venía de /registro, se crea su tenant en prueba.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const provisioned = user ? await provisionPendingTenant(user) : null;
  if (provisioned) {
    if (provisioned.ok) return NextResponse.redirect(`${tenantOrigin(provisioned.slug, host)}/panel/bienvenida`);
    if (provisioned.reason === "slug_taken") return NextResponse.redirect(new URL("/registro/subdominio", origin));
    if (provisioned.reason === "trial_used") return NextResponse.redirect(new URL("/login?error=prueba_usada", origin));
    return NextResponse.redirect(new URL("/registro?error=registro_invalido", origin));
  }

  // Invitaciones y recuperaciones deben pasar por "define tu contraseña" antes de entrar.
  const destination =
    type === "invite" || type === "recovery"
      ? "/recuperar/nueva"
      : await resolveDestination(supabase, host, next);

  return NextResponse.redirect(new URL(destination, origin));
}
