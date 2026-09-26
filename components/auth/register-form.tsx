"use client";

import Script from "next/script";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SlugField } from "@/components/auth/slug-field";
import { chooseSlug, register, type RegisterState } from "@/app/registro/actions";
import { GIROS } from "@/lib/auth/register-schema";

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground-muted">
        {label}
      </label>
      <Input id={id} name={id} type={type} autoComplete={autoComplete} required aria-invalid={Boolean(error)} />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function RegisterForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(register, undefined);

  useEffect(() => {
    if (state?.error || state?.errors) window.turnstile?.reset();
  }, [state]);

  if (state?.sentTo) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface p-4 text-sm text-foreground-muted">
        <p className="font-medium text-foreground">Revisa tu correo</p>
        <p className="mt-1">
          Enviamos un enlace de confirmación a {state.sentTo}. Al abrirlo se crea tu espacio y empieza
          tu prueba de 7 días.
        </p>
      </div>
    );
  }

  const errors = state?.errors ?? {};
  const error = state?.error ?? initialError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="business" label="Nombre de tu negocio" autoComplete="organization" error={errors.business} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="giro" className="text-xs font-medium text-foreground-muted">
          Giro
        </label>
        <Select id="giro" name="giro" defaultValue="" required>
          <option value="" disabled>
            Elige uno
          </option>
          {Object.entries(GIROS).map(([key, giro]) => (
            <option key={key} value={key}>
              {giro.label}
            </option>
          ))}
        </Select>
        {errors.giro ? <p className="text-xs text-danger">{errors.giro}</p> : null}
      </div>
      <SlugField error={errors.slug} />
      <Field id="fullName" label="Tu nombre" autoComplete="name" error={errors.fullName} />
      <Field id="email" label="Correo" type="email" autoComplete="email" error={errors.email} />
      <Field id="password" label="Contraseña (mínimo 8 caracteres)" type="password" autoComplete="new-password" error={errors.password} />

      {TURNSTILE_KEY ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-theme="light" />
        </>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Creando tu espacio..." : "Empezar prueba de 7 días"}
      </Button>
    </form>
  );
}

export function ChooseSlugForm({ suggestion }: { suggestion: string }) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(chooseSlug, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SlugField error={state?.errors?.slug} onSuggest={suggestion} />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando tu espacio..." : "Usar este subdominio"}
      </Button>
    </form>
  );
}
