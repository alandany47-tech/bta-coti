"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptWithSession, createAccountAndAccept } from "@/app/invitacion/[token]/actions";

export function JoinButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(() => acceptWithSession(token), undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando..." : "Unirme al equipo"}
      </Button>
    </form>
  );
}

export function CreateAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(createAccountAndAccept.bind(null, token), undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-foreground-muted">
          Correo
        </label>
        <Input id="email" value={email} readOnly disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-foreground-muted">
          Crea tu contraseña
        </label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-xs font-medium text-foreground-muted">
          Repite la contraseña
        </label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creando tu cuenta..." : "Crear cuenta y entrar"}
      </Button>
    </form>
  );
}
