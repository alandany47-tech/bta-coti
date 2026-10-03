import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ModuleLanding } from "@/components/marketing/module-landing";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Publica tu catálogo de productos, compartible con un link.",
};

export default async function CatalogoPage() {
  const supabase = createServerSupabaseClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("code, price_month")
    .eq("code", "catalogo")
    .eq("public", true)
    .maybeSingle();

  return (
    <>
      <SiteHeader />
      <ModuleLanding
        eyebrow="Módulo Catálogo"
        title="Publica tu catálogo de productos"
        description="Tus productos organizados por categoría en una página pública compartible con un link. Para tiendas y mayoristas."
        status="available"
        screenshotSrc="/marketing/hero-catalogo-storefront-v2.jpg"
        screenshotAlt="Catálogo público de productos, ejemplo de una mueblería"
        planCode="catalogo"
        priceMonth={plan ? Number(plan.price_month) : 399}
        features={[
          "Catálogo de productos por categoría, con precio y unidad",
          "Página pública compartible con un link, sin que tu cliente necesite cuenta",
          "Editor con portada y orden de secciones — en camino",
          "Cotización y envío por WhatsApp y PDF — en camino",
        ]}
      />
      <SiteFooter />
    </>
  );
}
