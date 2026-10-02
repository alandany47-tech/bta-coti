import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ModuleLanding } from "@/components/marketing/module-landing";

export const metadata: Metadata = {
  title: "Broker",
  description: "Cotiza propiedades con enganche y mensualidades calculadas al instante.",
};

export default async function BrokersPage() {
  const supabase = createServerSupabaseClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("code, price_month")
    .eq("code", "broker")
    .eq("public", true)
    .maybeSingle();

  return (
    <>
      <SiteHeader />
      <ModuleLanding
        eyebrow="Módulo Broker"
        title="Cotiza propiedades en 60 segundos"
        description="Sube tu cartera con fotos y plano, arma la cotización con enganche y mensualidades, y mándala por WhatsApp con el PDF listo."
        status="available"
        screenshotSrc="/marketing/hero-broker-storefront.jpg"
        screenshotAlt="Catálogo de propiedades del módulo Broker"
        planCode="broker"
        priceMonth={plan ? Number(plan.price_month) : 699}
        features={[
          "Catálogo de propiedades con fotos, plano y estado (disponible, reservada, vendida)",
          "Calculadora de enganche, mensualidades y saldo a escrituración",
          "Cotización con vigencia y folio consecutivo",
          "Link compartible por WhatsApp, con PDF descargable",
          "Mini-CRM: registra a quién le mandaste cada cotización",
          "Import de tu cartera desde Excel",
        ]}
      />
      <SiteFooter />
    </>
  );
}
