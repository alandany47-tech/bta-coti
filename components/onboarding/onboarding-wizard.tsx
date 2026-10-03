"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { LogoColorStep } from "@/components/onboarding/logo-color-step";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import type { PublicTenant } from "@/lib/types";

function StepDot({ done }: { done: boolean }) {
  return (
    <span className={cn("flex h-2 w-2 rounded-full", done ? "bg-ok" : "bg-border-subtle")} aria-hidden />
  );
}

function StepHeader({ done, title }: { done: boolean; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-xs",
          done ? "bg-ok text-background" : "border border-border-subtle text-muted",
        )}
      >
        {done ? <Check className="h-3 w-3" /> : null}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

/**
 * Wizard de 3 pasos (T23): logo y color → ítems → primera cotización. Cada paso se marca
 * "completo" a partir de datos reales (logo_url, items_count, si ya existe alguna cotización) —
 * solo el "saltar" explícito se persiste en `tenants.settings` (docs/ROADMAP.md T23).
 */
export function OnboardingWizard({
  tenant: initialTenant,
  hasItems,
  hasQuotes,
  canImport,
  mode,
  hasWhatsapp,
}: {
  tenant: PublicTenant;
  hasItems: boolean;
  hasQuotes: boolean;
  canImport: boolean;
  /** `broker` = cotizador de propiedades; `catalog` = catálogo de productos/servicios. */
  mode: "broker" | "catalog";
  hasWhatsapp: boolean;
}) {
  const [tenant, setTenant] = useState(initialTenant);
  const [dismissing, setDismissing] = useState(false);
  const router = useRouter();

  const step1Done = Boolean(tenant.logo_url);
  const isBroker = mode === "broker";
  const step3Done = isBroker ? hasQuotes : hasWhatsapp;
  const steps = [step1Done, hasItems, step3Done];

  async function handleSkip() {
    setDismissing(true);
    await fetch(`/api/${tenant.slug}/onboarding/dismiss`, { method: "POST" });
    router.push("/panel");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl tracking-tight text-foreground">Bienvenido a {BRAND.name}</h1>
      <p className="mt-3 text-foreground-muted">
        Tu espacio <span className="font-medium text-foreground">{tenant.name}</span> ya está listo. Estos 3 pasos te
        dejan {isBroker ? "cotizando" : "vendiendo"} en minutos — puedes saltarlos y volver después.
      </p>

      <div className="mt-6 flex items-center gap-2">
        {steps.map((done, i) => (
          <StepDot key={i} done={done} />
        ))}
      </div>

      <div className="mt-8 flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
        <section className="py-6">
          <StepHeader done={step1Done} title="1. Logo y color" />
          <LogoColorStep
            tenantSlug={tenant.slug}
            tenantName={tenant.name}
            logoUrl={tenant.logo_url}
            brandColor={tenant.brand_color}
            isDemo={tenant.is_demo}
            onLogoChange={(url) => setTenant((t) => ({ ...t, logo_url: url }))}
            onColorChange={(color) => setTenant((t) => ({ ...t, brand_color: color }))}
          />
        </section>

        <section className="py-6">
          <StepHeader done={hasItems} title={isBroker ? "2. Carga tu cartera" : "2. Agrega tus productos o servicios"} />
          {!isBroker ? (
            canImport ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted">Con foto, precio y una descripción corta. Tarda un minuto por ítem.</p>
                <Link href="/panel/catalogo" className="shrink-0 text-sm underline hover:text-foreground">
                  Ir a Catálogo
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">Pide a un editor de tu equipo que cargue el catálogo.</p>
            )
          ) : canImport ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted">Importa un Excel con tus propiedades o servicios.</p>
              <Link href="/panel/importar" className="shrink-0 text-sm underline hover:text-foreground">
                Importar cartera
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">Pide a un editor de tu equipo que importe la cartera.</p>
          )}
        </section>

        <section className="py-6">
          <StepHeader done={step3Done} title={isBroker ? "3. Haz tu primera cotización" : "3. Pon tu WhatsApp y comparte tu catálogo"} />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {isBroker
                ? "Elige una propiedad, ajusta el enganche y envíala por WhatsApp."
                : "Tus clientes arman su cotización en tu página y te la mandan por WhatsApp."}
            </p>
            <Link href={isBroker ? "/panel" : "/panel/negocio"} className="shrink-0 text-sm underline hover:text-foreground">
              {isBroker ? "Cotizar" : "Mi negocio"}
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <Button variant="secondary" disabled={dismissing} onClick={handleSkip}>
          {dismissing ? "..." : "Saltar por ahora"}
        </Button>
      </div>
    </div>
  );
}
