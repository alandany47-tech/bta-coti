import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  // No es admin, pero puede que sí haya una sesión (cuenta sin permisos):
  // se avisa explícitamente en vez de dejarlo adivinar por qué el login
  // "no lo deja entrar" cuando en realidad sí inició sesión.
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            BTA Cotiza
          </h1>
          <p className="mt-1 text-sm text-muted">Master Console</p>
        </div>

        {user ? (
          <div className="mb-6 rounded-md border border-border-subtle bg-surface p-4 text-sm text-foreground-muted">
            <p>
              <span className="text-foreground">{user.email}</span> no tiene
              permisos de administrador.
            </p>
            <form action="/api/admin/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="text-sm text-muted underline hover:text-foreground"
              >
                Cerrar sesión e intentar con otra cuenta
              </button>
            </form>
          </div>
        ) : null}

        <LoginForm />
      </div>
    </div>
  );
}
