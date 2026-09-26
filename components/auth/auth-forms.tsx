"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  sendMagicLink,
  signInWithPassword,
  type FormState,
} from "@/app/login/actions";
import { updatePassword } from "@/app/recuperar/nueva/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Field({
  id,
  label,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground-muted">
        {label}
      </label>
      <Input id={id} name={id} type={type} autoComplete={autoComplete} required />
    </div>
  );
}

function Form({
  action,
  submit,
  pending: pendingLabel,
  next,
  children,
}: {
  action: Action;
  submit: string;
  pending: string;
  next?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {children}
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-ok">{state.message}</p> : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? pendingLabel : submit}
      </Button>
    </form>
  );
}

export function PasswordLoginForm({ next }: { next?: string }) {
  return (
    <Form action={signInWithPassword} submit="Entrar" pending="Entrando..." next={next}>
      <Field id="email" label="Correo" type="email" autoComplete="email" />
      <Field id="password" label="Contraseña" type="password" autoComplete="current-password" />
    </Form>
  );
}

export function MagicLinkForm({ next }: { next?: string }) {
  return (
    <Form action={sendMagicLink} submit="Enviar enlace" pending="Enviando..." next={next}>
      <Field id="email" label="Correo" type="email" autoComplete="email" />
    </Form>
  );
}

export function ResetRequestForm() {
  return (
    <Form action={requestPasswordReset} submit="Enviar enlace" pending="Enviando...">
      <Field id="email" label="Correo" type="email" autoComplete="email" />
    </Form>
  );
}

export function NewPasswordForm() {
  return (
    <Form action={updatePassword} submit="Guardar contraseña" pending="Guardando...">
      <Field id="password" label="Nueva contraseña" type="password" autoComplete="new-password" />
      <Field id="confirm" label="Repite la contraseña" type="password" autoComplete="new-password" />
    </Form>
  );
}
