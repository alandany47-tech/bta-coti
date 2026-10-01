import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Ayuda",
  description: `Preguntas frecuentes sobre ${BRAND.name}.`,
};

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const SECTIONS = [
  {
    title: "Empezar",
    items: [
      {
        q: "¿Cómo creo mi cuenta?",
        a: "Entra a /registro, escribe el nombre de tu negocio y tu correo. Tu cuenta queda lista con 7 días de prueba, sin tarjeta.",
      },
      {
        q: "¿Cómo entro después de registrarme?",
        a: "Desde /login, con tu correo y contraseña, o con el link mágico que te mandamos por correo.",
      },
      {
        q: "¿Puedo probar sin crear una cuenta?",
        a: "Sí, entra a la demo en vivo desde la página principal; es una cuenta compartida que se reinicia cada noche.",
      },
    ],
  },
  {
    title: "Cotizaciones",
    items: [
      {
        q: "¿Cómo le mando una cotización a mi cliente?",
        a: "Desde tu panel, arma la cotización y usa el botón de WhatsApp. Tu cliente recibe un link; no necesita cuenta.",
      },
      {
        q: "¿Puedo editar una cotización ya enviada?",
        a: "No: una vez enviada queda congelada con los montos de ese momento, aunque después cambies precios en tu catálogo. Si algo cambió, crea una cotización nueva.",
      },
      {
        q: "¿Cuánto tiempo es válida una cotización?",
        a: "30 días desde que se crea.",
      },
    ],
  },
  {
    title: "Cuenta y pagos",
    items: [
      {
        q: "¿Cómo cambio de plan?",
        a: "Desde tu panel, en Facturación. Subir de plan es inmediato; bajar se aplica al siguiente ciclo.",
      },
      {
        q: "¿Qué pasa si mi pago falla?",
        a: "Tienes 7 días de gracia para actualizar tu método de pago antes de que la cuenta se suspenda.",
      },
      {
        q: "¿Cómo cancelo mi cuenta?",
        a: "Desde el portal de facturación de tu panel, sin penalización.",
      },
    ],
  },
];

export default function AyudaPage() {
  const supportDigits = SUPPORT_WHATSAPP.replace(/[^\d]/g, "");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[720px] px-6 py-16">
          <h1 className="font-display text-[44px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">Ayuda</h1>
          <p className="mt-3 text-base text-ink-2">
            Preguntas frecuentes.{supportDigits ? " Si no encuentras la tuya, escríbenos." : ""}
          </p>

          <div className="mt-12 flex flex-col gap-12">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-display text-[24px] font-medium text-ink">{section.title}</h2>
                <div className="mt-4 flex flex-col divide-y divide-line">
                  {section.items.map((item) => (
                    <div key={item.q} id={slugify(item.q)} className="scroll-mt-20 py-4">
                      <h3 className="font-medium text-ink">{item.q}</h3>
                      <p className="mt-1 text-sm text-ink-2">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {supportDigits ? (
            <div className="mt-12 rounded-lg border border-line bg-surface p-6">
              <p className="font-medium text-ink">¿No encontraste tu respuesta?</p>
              <a
                href={`https://wa.me/${supportDigits}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-accent hover:underline"
              >
                Escríbenos por WhatsApp →
              </a>
            </div>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
