import Link from "next/link";
import { ResetRequestForm } from "@/components/auth/auth-forms";

export default function RecoverPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl tracking-tight text-foreground">Recupera tu acceso</h1>
        <p className="mb-6 text-center text-sm text-muted">
          Te enviamos un enlace para cambiar tu contraseña.
        </p>
        <ResetRequestForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted underline hover:text-foreground">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
