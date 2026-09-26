import Link from "next/link";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/components/auth/auth-forms";

export default async function NewPasswordPage() {
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl tracking-tight text-foreground">Define tu contraseña</h1>
        {user ? (
          <NewPasswordForm />
        ) : (
          <p className="text-center text-sm text-muted">
            El enlace venció o ya se usó.{" "}
            <Link href="/recuperar" className="underline hover:text-foreground">
              Solicita uno nuevo
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
