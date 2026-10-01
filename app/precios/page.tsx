import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes desde $199/mes. Prueba 7 días gratis, sin tarjeta.",
};

const BILLING_FAQ = [
  {
    q: "¿Cómo se paga?",
    a: "Con tarjeta o transferencia SPEI, directo desde tu panel. Los precios están en pesos mexicanos.",
  },
  {
    q: "¿Necesito factura?",
    a: "Sí se puede facturar; escríbenos por WhatsApp con tus datos fiscales después de tu primer pago.",
  },
  {
    q: "¿Puedo cambiar o cancelar cuando quiera?",
    a: "Sí. Subir de plan es inmediato; bajar de plan o cancelar se aplica al siguiente ciclo, sin penalización.",
  },
  {
    q: "¿Qué pasa si se me acaba la prueba?",
    a: "Tu cuenta se suspende (los datos no se borran) hasta que elijas un plan y pagues.",
  },
];

export default async function PreciosPage() {
  const supabase = createServerSupabaseClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, price_month, price_year, limits, sort")
    .eq("public", true)
    .order("sort");

  const mapped = (plans ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceMonth: Number(p.price_month),
    priceYear: Number(p.price_year),
    limits: (p.limits ?? {}) as Record<string, number | null>,
    sort: p.sort,
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1120px] px-6 pt-16 pb-8">
          <h1 className="font-display text-[44px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">Precios</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-2">
            Un plan para cada tamaño de negocio. Prueba 7 días gratis, sin tarjeta.
          </p>
        </section>

        <section className="mx-auto w-full max-w-[1120px] px-6 pb-16">
          <PricingTable plans={mapped} />
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Facturación</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {BILLING_FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="font-medium text-ink">{item.q}</h3>
                  <p className="mt-1 text-sm text-ink-2">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
