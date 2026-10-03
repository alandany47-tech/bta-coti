import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { BRAND } from "@/lib/brand";
import { tenantOrigin } from "@/lib/auth/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn, formatCurrency } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const STEPS = [
  { n: "1", title: "Sube tu catálogo", body: "Importa tus propiedades desde Excel o agrégalas una por una, con fotos." },
  { n: "2", title: "Arma la cotización", body: "Elige la unidad, ajusta enganche y mensualidades. El cálculo es automático." },
  { n: "3", title: "Mándala por WhatsApp", body: "Un link con el PDF listo. Tu cliente la ve en el navegador, sin descargar nada." },
];

const FAQ = [
  {
    q: "¿Cuánto dura la prueba gratis?",
    a: "7 días, con todas las funciones de tu plan. No pedimos tarjeta para empezar.",
  },
  {
    q: "¿Cómo le llega la cotización a mi cliente?",
    a: "Le mandas un link por WhatsApp. Lo abre en el navegador y puede descargar el PDF; no necesita cuenta ni instalar nada.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí, en cualquier momento desde tu panel. Si subes de plan el cambio es inmediato; si bajas, se aplica al siguiente ciclo.",
  },
  {
    q: "¿Cómo se paga?",
    a: "Con tarjeta o transferencia SPEI. Los precios están en pesos mexicanos.",
  },
  {
    q: "¿Mis datos y los de mis clientes están seguros?",
    a: "Cada negocio tiene su propio espacio aislado en la base de datos; nadie de otro negocio puede ver o escribir tu información.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización, desde el portal de facturación de tu panel.",
  },
];

export default async function MarketingHome() {
  const supabase = createServerSupabaseClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, price_month, sort")
    .eq("public", true)
    .order("sort");

  const brokerFrom = plans?.find((p) => p.code === "broker")?.price_month;
  const esencialFrom = plans?.find((p) => p.code === "esencial")?.price_month;
  const catalogoFrom = plans?.find((p) => p.code === "catalogo")?.price_month;

  // Cada giro enseña un negocio de ejemplo real (docs/DEMO.md §4.1): Broker abre el panel
  // interactivo; Servicios y Catálogo, que aún no tienen cotizador propio (T30/T32), enseñan su
  // catálogo público. Los enlaces son del subdominio del tenant, así que se arman con el host.
  const host = (await headers()).get("host") ?? "";
  const modules = [
    {
      name: "Broker",
      body: "Propiedades, enganches y mensualidades, cotización en un clic.",
      from: brokerFrom,
      image: "/marketing/hero-broker-storefront-v2.jpg",
      alt: "Catálogo de propiedades del módulo Broker",
      href: "/demo/entrar",
      cta: "Probar el panel de ejemplo",
    },
    {
      name: "Servicios",
      body: "Catálogo de servicios y materiales por categoría.",
      from: esencialFrom,
      image: "/marketing/hero-servicios-storefront-v2.jpg",
      alt: "Catálogo público de servicios del módulo Servicios",
      href: tenantOrigin("demo-esencial", host),
      cta: "Ver catálogo de ejemplo",
    },
    {
      name: "Catálogo",
      body: "Publica tu catálogo de productos, compartible con un link.",
      from: catalogoFrom,
      image: "/marketing/hero-catalogo-storefront-v2.jpg",
      alt: "Catálogo público de productos del módulo Catálogo",
      href: tenantOrigin("demo-catalogo", host),
      cta: "Ver catálogo de ejemplo",
    },
  ];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-[1120px] px-6 pt-16 pb-20 sm:pt-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-accent">{BRAND.name}</p>
            <h1 className="mt-3 font-display text-[44px] font-medium leading-[1.15] tracking-[-0.01em] text-ink sm:text-[60px]">
              Cotizaciones que cierran ventas.
            </h1>
            <p className="mt-4 text-lg text-ink-2">
              Listas en 60 segundos, con el cálculo correcto cada vez. Sin hojas de cálculo, sin errores de dedo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/registro" className={buttonVariants({ size: "lg" })}>
                Prueba 7 días gratis
              </Link>
              <Link href="/demo/entrar" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Ver demo en vivo
              </Link>
            </div>
          </div>

          <div className="mt-14 flex items-end justify-center gap-4">
            <div className="hidden w-[45%] max-w-[420px] overflow-hidden rounded-xl border border-line shadow-lg sm:block">
              <Image
                src="/marketing/hero-cotizacion-desktop-v2.jpg"
                alt={`Cotización real de ${BRAND.name}, vista de escritorio`}
                width={860}
                height={836}
                sizes="(min-width: 640px) 45vw, 420px"
                className="w-full"
                priority
              />
            </div>
            <div className="relative w-[72%] max-w-[260px] overflow-hidden rounded-xl border border-line shadow-lg sm:w-[22%]">
              <Image
                src="/marketing/hero-cotizacion-mobile-v2.jpg"
                alt={`Cotización real de ${BRAND.name}, vista de celular`}
                width={292}
                height={634}
                sizes="(min-width: 640px) 22vw, 260px"
                className="w-full"
                priority
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-paper to-transparent"
              />
            </div>
          </div>
        </section>

        {/* Tres módulos */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Un módulo por cada giro</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {modules.map((module) => (
                <a
                  key={module.name}
                  href={module.href}
                  className="group flex flex-col overflow-hidden rounded-lg border border-line bg-paper transition-colors hover:border-ink-3"
                >
                  {/* El degradado del borde inferior avisa que la captura sigue: sin él la miniatura parecía cortada a media fila. */}
                  <div className="relative border-b border-line">
                    <Image
                      src={module.image}
                      alt={module.alt}
                      width={752}
                      height={564}
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className="aspect-[4/3] w-full object-cover object-top"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper to-transparent"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-5">
                    <h3 className="font-medium text-ink">{module.name}</h3>
                    <p className="text-sm text-ink-2">{module.body}</p>
                    {module.from ? (
                      <p className="mt-2 text-sm text-ink-2">Desde {formatCurrency(module.from)}/mes</p>
                    ) : null}
                    <span className="mt-auto pt-3 text-sm font-medium text-accent group-hover:underline">
                      {module.cta} →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Cómo funciona</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col gap-2">
                  <span className="font-display text-2xl text-accent">{step.n}</span>
                  <h3 className="font-medium text-ink">{step.title}</h3>
                  <p className="text-sm text-ink-2">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo en vivo */}
        <section className="border-t border-line bg-ink">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-start gap-4 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-[24px] font-medium text-paper">Pruébalo sin registrarte</h2>
              <p className="mt-2 text-sm text-paper/70">
                Entra al panel de una inmobiliaria de ejemplo y arma una cotización de prueba, con PDF y
                WhatsApp. No se guarda nada.
              </p>
            </div>
            <Link
              href="/demo/entrar"
              className={cn(buttonVariants({ size: "lg" }), "bg-paper text-ink hover:bg-sunken")}
            >
              Ver demo en vivo
            </Link>
          </div>
        </section>

        {/* Precios resumidos */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Precios</h2>
              <Link href="/precios" className="text-sm text-accent hover:underline">
                Ver todos los planes →
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {(plans ?? []).map((plan) => (
                <div key={plan.code} className="rounded-lg border border-line p-5">
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="mt-1 text-sm text-ink-2">{formatCurrency(Number(plan.price_month))}/mes</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Preguntas frecuentes</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="font-medium text-ink">{item.q}</h3>
                  <p className="mt-1 text-sm text-ink-2">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-4 px-6 py-20 text-center">
            <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">
              Tu primera cotización, lista hoy.
            </h2>
            <Link href="/registro" className={buttonVariants({ size: "lg" })}>
              Prueba 7 días gratis
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
