import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/auth/destination";
import { RegisterForm } from "@/components/auth/register-form";
import { BRAND } from "@/lib/brand";

const ERRORS: Record<string, string> = {
  registro_invalido: "No pudimos completar tu registro. Vuelve a llenar el formulario.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const host = (await headers()).get("host") ?? "";
    redirect(await resolveDestination(supabase, host));
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl tracking-tight text-foreground">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-muted">Crea tu espacio. 7 días de prueba, sin tarjeta.</p>
        </div>
        <RegisterForm initialError={error ? ERRORS[error] : undefined} />
        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline hover:text-foreground">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
