"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, createSessionSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/abuse";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";
import { provisionPendingTenant, provisionTenant } from "@/lib/auth/provision";
import {
  normalizeSlugInput,
  parsePendingTenant,
  slugError,
  validateRegistration,
  type FieldErrors,
} from "@/lib/auth/register-schema";

export type RegisterState =
  | { error?: string; errors?: FieldErrors; sentTo?: string }
  | undefined;

const RATE_LIMITED = "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
const SLUG_TAKEN = "Ese subdominio no está disponible. Prueba con otro.";
const GENERIC = "No pudimos crear tu cuenta. Inténtalo de nuevo en un momento.";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

async function slugIsFree(slug: string) {
  const { data } = await createServerSupabaseClient().rpc("slug_available", { p_slug: slug });
  return data === true;
}

export async function register(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const h = await headers();
  const limit = await checkRateLimit("register", getClientIp(h));
  if (!limit.ok) return { error: RATE_LIMITED };

  const parsed = validateRegistration({
    business: field(formData, "business"),
    giro: field(formData, "giro"),
    slug: field(formData, "slug"),
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.ok) return { errors: parsed.errors };
  const { fullName, email, password, ...pending } = parsed.value;

  if (await isDisposableEmail(email)) {
    return { errors: { email: "Usa un correo que no sea temporal o desechable." } };
  }
  if (!(await slugIsFree(pending.slug))) return { errors: { slug: SLUG_TAKEN } };

  const captchaToken = field(formData, "cf-turnstile-response");
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
    return { error: "Completa la verificación antes de continuar." };
  }

  const host = h.get("host") ?? "";
  const callback = new URL("/auth/callback", rootOrigin(host));
  callback.searchParams.set("src", "signup");

  const supabase = await createSessionSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callback.toString(),
      captchaToken: captchaToken || undefined,
      data: { full_name: fullName, pending_tenant: pending },
    },
  });
  if (error) return { error: GENERIC };

  // Con la confirmación de correo desactivada, Supabase ya entrega la sesión.
  if (data.session && data.user) {
    const result = await provisionPendingTenant(data.user);
    if (result?.ok) redirect(`${tenantOrigin(result.slug, host)}/panel/bienvenida`);
    if (result && !result.ok && result.reason === "slug_taken") redirect("/registro/subdominio");
    return { error: GENERIC };
  }

  return { sentTo: email };
}

export async function chooseSlug(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const h = await headers();
  const limit = await checkRateLimit("register", getClientIp(h));
  if (!limit.ok) return { error: RATE_LIMITED };

  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const current = parsePendingTenant(user.user_metadata?.pending_tenant);
  if (!current) redirect("/login");

  const slug = normalizeSlugInput(field(formData, "slug"));
  const problem = slugError(slug);
  if (problem) return { errors: { slug: problem } };
  if (!(await slugIsFree(slug))) return { errors: { slug: SLUG_TAKEN } };

  const result = await provisionTenant(user.id, { ...current, slug });
  const host = h.get("host") ?? "";
  if (result.ok) redirect(`${tenantOrigin(result.slug, host)}/panel/bienvenida`);
  if (result.reason === "slug_taken") return { errors: { slug: SLUG_TAKEN } };
  if (result.reason === "trial_used") redirect("/login?error=prueba_usada");
  return { error: GENERIC };
}
