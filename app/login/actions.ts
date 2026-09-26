"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveDestination } from "@/lib/auth/destination";
import { rootOrigin, safeNext } from "@/lib/auth/redirects";

export type FormState = { error?: string; message?: string } | undefined;

const RATE_LIMITED = "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";

async function requestContext() {
  const h = await headers();
  const limit = await checkRateLimit("login", getClientIp(h));
  return { host: h.get("host") ?? "", limited: !limit.ok };
}

export async function signInWithPassword(_: FormState, formData: FormData): Promise<FormState> {
  const { host, limited } = await requestContext();
  if (limited) return { error: RATE_LIMITED };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await createSessionSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect(await resolveDestination(supabase, host, String(formData.get("next") ?? "")));
}

export async function sendMagicLink(_: FormState, formData: FormData): Promise<FormState> {
  const { host, limited } = await requestContext();
  if (limited) return { error: RATE_LIMITED };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu correo." };

  const next = safeNext(String(formData.get("next") ?? ""), host);
  const callback = new URL("/auth/callback", rootOrigin(host));
  callback.searchParams.set("src", "magiclink");
  if (next) callback.searchParams.set("next", next);

  const supabase = await createSessionSupabaseClient();
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });
  return { message: "Si el correo tiene una cuenta, te enviamos un enlace para entrar." };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const { host, limited } = await requestContext();
  if (limited) return { error: RATE_LIMITED };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu correo." };

  const callback = new URL("/auth/callback", rootOrigin(host));
  callback.searchParams.set("next", "/recuperar/nueva");

  const supabase = await createSessionSupabaseClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  return { message: "Si el correo tiene una cuenta, te enviamos un enlace para cambiar la contraseña." };
}
