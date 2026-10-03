"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/login/actions";
import { tenantOrigin } from "@/lib/auth/redirects";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceRoleClient, createSessionSupabaseClient } from "@/lib/supabase/server";
import { hashInvitationToken } from "@/lib/team";

/**
 * Aceptar una invitación al equipo (T33). Service role a propósito (como `get_shared_quote`): las
 * funciones `invitation_preview`/`accept_invitation` solo las ejecuta el servidor, que valida el token
 * (se compara su hash) y que quien acepta tiene el correo invitado. Nada de esto vive bajo /api/[tenant].
 */
type Preview = { invitation_id: string; tenant_slug: string; tenant_name: string; email: string; role: string; status: string; user_exists: boolean };

async function preview(token: string): Promise<Preview | null> {
  if (!token || token.length > 200) return null;
  const { data } = await createServiceRoleClient().rpc("invitation_preview", { p_token_hash: hashInvitationToken(token) });
  return ((data as Preview[] | null) ?? [])[0] ?? null;
}

function acceptError(message: string | undefined): string {
  if (message?.includes("user_quota_exceeded")) return "Este negocio ya no tiene lugares libres. Pídele al dueño que revise su plan.";
  if (message?.includes("email_mismatch")) return "Esta invitación es para otro correo.";
  if (message?.includes("invitation_invalid")) return "La invitación venció o ya se usó. Pide una nueva.";
  return "No pudimos completar tu acceso. Inténtalo de nuevo.";
}

async function accept(token: string, userId: string): Promise<{ slug: string } | { error: string }> {
  const { data, error } = await createServiceRoleClient().rpc("accept_invitation", { p_token_hash: hashInvitationToken(token), p_user: userId });
  if (error || typeof data !== "string") return { error: acceptError(error?.message) };
  return { slug: data };
}

/** Ya hay sesión con el mismo correo: solo falta confirmar. */
export async function acceptWithSession(token: string): Promise<FormState> {
  const h = await headers();
  if (!(await checkRateLimit("login", getClientIp(h))).ok) return { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." };

  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión para aceptar la invitación." };

  const result = await accept(token, user.id);
  if ("error" in result) return { error: result.error };
  redirect(`${tenantOrigin(result.slug, h.get("host") ?? "")}/panel`);
}

/** No existe cuenta con ese correo: se crea con la contraseña elegida (el token enviado al correo prueba que es suyo). */
export async function createAccountAndAccept(token: string, _: FormState, formData: FormData): Promise<FormState> {
  const h = await headers();
  if (!(await checkRateLimit("login", getClientIp(h))).ok) return { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  const inv = await preview(token);
  if (!inv || inv.status !== "pending") return { error: "La invitación venció o ya se usó. Pide una nueva." };
  if (inv.user_exists) return { error: "Ya existe una cuenta con ese correo. Inicia sesión para aceptar." };

  const admin = createServiceRoleClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: inv.email, password, email_confirm: true });
  if (createError || !created.user) {
    return { error: "No pudimos crear tu cuenta. Si ya tienes una con ese correo, inicia sesión para aceptar." };
  }

  const result = await accept(token, created.user.id);
  if ("error" in result) {
    // La cuenta nueva no debe quedar huérfana si el lugar ya no existe.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: result.error };
  }

  const supabase = await createSessionSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: inv.email, password });
  if (signInError) redirect("/login");
  redirect(`${tenantOrigin(result.slug, h.get("host") ?? "")}/panel`);
}
