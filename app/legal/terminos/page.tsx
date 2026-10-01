import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Términos de servicio",
};

export default function TerminosPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[640px] px-6 py-16">
          <div className="mb-8 rounded-md border border-warn/30 bg-warn/10 p-4 text-sm text-ink">
            <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue
            revisado por un abogado y no debe usarse para cobrar a clientes reales hasta que se apruebe.
          </div>

          <h1 className="font-display text-[32px] font-medium text-ink">Términos de servicio</h1>
          <p className="mt-2 text-sm text-ink-2">Última actualización: [pendiente].</p>

          <div className="mt-8 flex flex-col gap-6 text-ink-2">
            <section id="quienes-somos">
              <h2 className="font-display text-[20px] font-medium text-ink">1. Quiénes somos</h2>
              <p className="mt-1">
                {BRAND.name} es operado por [razón social pendiente], con domicilio en [domicilio fiscal
                pendiente]. Estos términos rigen el uso de la plataforma en {BRAND.domain} y sus subdominios.
              </p>
            </section>
            <section id="el-servicio">
              <h2 className="font-display text-[20px] font-medium text-ink">2. El servicio</h2>
              <p className="mt-1">
                {BRAND.name} es un cotizador SaaS: cada negocio ("tenant") tiene su propio espacio para
                administrar su catálogo, generar cotizaciones y compartirlas con sus clientes.
              </p>
            </section>
            <section id="cuenta-y-prueba">
              <h2 className="font-display text-[20px] font-medium text-ink">3. Cuenta y prueba gratuita</h2>
              <p className="mt-1">
                La prueba gratuita dura 7 días. Al terminar, la cuenta se suspende (sin borrar datos) hasta
                elegir un plan de pago. Eres responsable de la actividad de tu cuenta y de mantener segura tu
                contraseña.
              </p>
            </section>
            <section id="pagos-y-cancelacion">
              <h2 className="font-display text-[20px] font-medium text-ink">4. Pagos y cancelación</h2>
              <p className="mt-1">
                Los planes se cobran por adelantado, mensual o anual, con tarjeta o transferencia SPEI. Puedes
                cancelar en cualquier momento desde tu panel; el servicio sigue activo hasta el final del
                periodo ya pagado.
              </p>
            </section>
            <section id="tus-datos">
              <h2 className="font-display text-[20px] font-medium text-ink">5. Tus datos y los de tus clientes</h2>
              <p className="mt-1">
                Eres dueño de la información que subes (catálogo, clientes, cotizaciones). Ver el{" "}
                <a href="/legal/privacidad" className="text-accent underline underline-offset-2">
                  Aviso de privacidad
                </a>{" "}
                para cómo la tratamos.
              </p>
            </section>
            <section id="uso-aceptable">
              <h2 className="font-display text-[20px] font-medium text-ink">6. Uso aceptable</h2>
              <p className="mt-1">
                No uses {BRAND.name} para actividades ilegales, para enviar spam, ni para suplantar a otro
                negocio. Nos reservamos el derecho de suspender cuentas que incumplan esto.
              </p>
            </section>
            <section id="cambios">
              <h2 className="font-display text-[20px] font-medium text-ink">7. Cambios a estos términos</h2>
              <p className="mt-1">
                Podemos actualizar estos términos; los cambios importantes se avisan por correo con
                anticipación razonable.
              </p>
            </section>
            <section id="contacto">
              <h2 className="font-display text-[20px] font-medium text-ink">8. Contacto</h2>
              <p className="mt-1">Dudas: [correo de contacto pendiente].</p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
