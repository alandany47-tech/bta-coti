"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/auth/destination";
import type { FormState } from "@/app/login/actions";

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace venció. Solicita uno nuevo." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No pudimos guardar la contraseña. Inténtalo de nuevo." };

  const host = (await headers()).get("host") ?? "";
  redirect(await resolveDestination(supabase, host));
}
