import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/auth/destination";
import { MagicLinkForm, PasswordLoginForm } from "@/components/auth/auth-forms";
import { BRAND } from "@/lib/brand";

const ERRORS: Record<string, string> = {
  enlace_invalido: "El enlace venció o ya se usó. Solicita uno nuevo.",
  sin_tenant: "Tu cuenta no está ligada a ningún negocio. Escríbenos para ayudarte.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && error !== "sin_tenant") {
    const host = (await headers()).get("host") ?? "";
    redirect(await resolveDestination(supabase, host, next));
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl tracking-tight text-foreground">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión</p>
        </div>

        {error && ERRORS[error] ? (
          <p className="mb-4 rounded-md border border-border-subtle bg-surface p-3 text-sm text-foreground-muted">
            {ERRORS[error]}
          </p>
        ) : null}

        {user ? (
          <form action="/auth/logout" method="post">
            <button type="submit" className="text-sm text-muted underline hover:text-foreground">
              Cerrar sesión e intentar con otra cuenta
            </button>
          </form>
        ) : (
          <>
            <PasswordLoginForm next={next} />
            <div className="my-6 border-t border-border-subtle" />
            <p className="mb-3 text-xs font-medium text-foreground-muted">
              O recibe un enlace en tu correo
            </p>
            <MagicLinkForm next={next} />
            <p className="mt-6 text-center text-sm">
              <Link href="/recuperar" className="text-muted underline hover:text-foreground">
                Olvidé mi contraseña
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
