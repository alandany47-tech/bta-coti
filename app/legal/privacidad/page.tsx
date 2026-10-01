import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
};

export default function PrivacidadPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[640px] px-6 py-16">
          <div className="mb-8 rounded-md border border-warn/30 bg-warn/10 p-4 text-sm text-ink">
            <strong>Borrador — pendiente de revisión legal.</strong> Este aviso de privacidad todavía no fue
            revisado por un abogado especialista en LFPDPPP y no debe publicarse como definitivo.
          </div>

          <h1 className="font-display text-[32px] font-medium text-ink">Aviso de privacidad</h1>
          <p className="mt-2 text-sm text-ink-2">Última actualización: [pendiente].</p>

          <div className="mt-8 flex flex-col gap-6 text-ink-2">
            <section id="responsable">
              <h2 className="font-display text-[20px] font-medium text-ink">1. Responsable</h2>
              <p className="mt-1">
                [Razón social pendiente], con domicilio en [domicilio fiscal pendiente], es responsable del
                tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos
                Personales en Posesión de los Particulares (LFPDPPP).
              </p>
            </section>
            <section id="datos-que-recabamos">
              <h2 className="font-display text-[20px] font-medium text-ink">2. Datos que recabamos</h2>
              <p className="mt-1">
                Nombre, correo y teléfono de quien crea una cuenta; nombre del negocio; y los datos que tú
                mismo cargas de tus clientes (nombre, teléfono) para generar cotizaciones.
              </p>
            </section>
            <section id="para-que-los-usamos">
              <h2 className="font-display text-[20px] font-medium text-ink">3. Para qué los usamos</h2>
              <ul className="mt-1 list-disc pl-5">
                <li>Darte acceso a tu cuenta y tu espacio dentro de {BRAND.name}.</li>
                <li>Procesar pagos de tu suscripción.</li>
                <li>Enviarte avisos operativos (pago fallido, prueba por vencer).</li>
                <li>Soporte cuando nos contactas.</li>
              </ul>
            </section>
            <section id="con-quien-compartimos-datos">
              <h2 className="font-display text-[20px] font-medium text-ink">4. Con quién compartimos datos</h2>
              <p className="mt-1">
                Con nuestros proveedores de infraestructura (hosting, base de datos, procesamiento de pagos y
                envío de WhatsApp) únicamente para operar el servicio. No vendemos tus datos ni los de tus
                clientes.
              </p>
            </section>
            <section id="derechos-arco">
              <h2 className="font-display text-[20px] font-medium text-ink">5. Derechos ARCO</h2>
              <p className="mt-1">
                Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos personales escribiendo a
                [correo de contacto pendiente].
              </p>
            </section>
            <section id="seguridad">
              <h2 className="font-display text-[20px] font-medium text-ink">6. Seguridad</h2>
              <p className="mt-1">
                Cada negocio tiene su información aislada de los demás a nivel de base de datos; nadie de un
                negocio distinto puede ver o modificar tus datos.
              </p>
            </section>
            <section id="cambios">
              <h2 className="font-display text-[20px] font-medium text-ink">7. Cambios a este aviso</h2>
              <p className="mt-1">Cualquier cambio relevante se publicará en esta misma página.</p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
