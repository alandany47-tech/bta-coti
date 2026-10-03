import type { ReactElement } from "react";
import { BRAND } from "@/lib/brand";
import { A, Cta, Divider, EmailLayout, P, Small, Steps } from "@/emails/layout";
import { rootUrl, tenantUrl } from "@/lib/email/links";

export type EmailKind = "welcome" | "trial_day5" | "trial_day7" | "trial_expired" | "payment_failed";

export type EmailData = {
  tenantName: string;
  slug: string;
  /** ISO de `tenants.trial_ends_at` (welcome y avisos de la prueba). */
  trialEndsAt?: string | null;
};

const dateFmt = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });

export function formatTrialEnd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFmt.format(date);
}

function Welcome({ tenantName, slug, trialEndsAt }: EmailData) {
  const ends = formatTrialEnd(trialEndsAt);
  return (
    <EmailLayout preview={`Tu espacio ${tenantName} ya está listo`} title={`Tu espacio ${tenantName} ya está listo`}>
      <P>
        Gracias por probar {BRAND.name}. {ends ? `Tienes hasta el ${ends} para usarlo sin costo.` : "Tu prueba gratis ya empezó."} Tres pasos y
        estás vendiendo:
      </P>
      <Steps items={["Sube tu logo y elige tu color.", "Agrega tus productos, servicios o propiedades.", "Pon tu WhatsApp y comparte tu enlace."]} />
      <Cta href={tenantUrl(slug, "/panel/bienvenida")}>Entrar a mi panel</Cta>
      <Divider />
      <Small>
        Tu página pública: <A href={tenantUrl(slug)}>{tenantUrl(slug)}</A>
      </Small>
    </EmailLayout>
  );
}

/** Sin contar días (el cron puede llegar tarde): con fecha cuando la hay, o "en menos de un día". */
function trialEndingTitle(tenantName: string, trialEndsAt: string | null | undefined, urgent: boolean): string {
  if (urgent) return `Tu prueba de ${tenantName} termina en menos de un día`;
  const ends = formatTrialEnd(trialEndsAt);
  return ends ? `Tu prueba de ${tenantName} termina el ${ends}` : `A tu prueba de ${tenantName} le quedan pocos días`;
}

function TrialEnding({ tenantName, slug, trialEndsAt, urgent }: EmailData & { urgent: boolean }) {
  const ends = formatTrialEnd(trialEndsAt);
  const title = trialEndingTitle(tenantName, trialEndsAt, urgent);
  return (
    <EmailLayout preview={ends ? `Tu prueba termina el ${ends}` : title} title={title}>
      <P>
        {ends ? `Tu prueba gratis termina el ${ends}. ` : ""}
        Si eliges un plan antes, no pierdes nada: tu catálogo, tus fotos y tus cotizaciones siguen exactamente como están.
      </P>
      <P>Si no, tu página se pausa hasta que elijas uno. Tus datos se conservan.</P>
      <Cta href={tenantUrl(slug, "/panel/facturacion")}>Elegir mi plan</Cta>
      <Divider />
      <Small>
        ¿Todavía no terminas de configurarlo? <A href={tenantUrl(slug, "/panel")}>Entra a tu panel</A> y te ayudamos si algo se atora.
      </Small>
    </EmailLayout>
  );
}

function TrialExpired({ tenantName, slug }: EmailData) {
  return (
    <EmailLayout preview="Tu página está en pausa. Tus datos siguen guardados" title={`La prueba de ${tenantName} terminó`}>
      <P>Tu página está en pausa y tus clientes ya no la ven, pero todo lo que cargaste sigue guardado.</P>
      <P>Elige un plan y la reactivamos al instante: mismo enlace, mismo catálogo.</P>
      <Cta href={tenantUrl(slug, "/panel/facturacion")}>Reactivar mi cuenta</Cta>
      <Divider />
      <Small>Si ya no la necesitas, no tienes que hacer nada.</Small>
    </EmailLayout>
  );
}

function PaymentFailed({ tenantName, slug }: EmailData) {
  return (
    <EmailLayout preview="No pudimos cobrar tu suscripción" title={`No pudimos cobrar la suscripción de ${tenantName}`}>
      <P>El cobro de tu plan no pasó (tarjeta rechazada, sin fondos o factura sin pagar). Tu página sigue activa por ahora.</P>
      <P>Actualiza tu método de pago en los próximos 7 días para que no se pause.</P>
      <Cta href={tenantUrl(slug, "/panel/facturacion")}>Actualizar mi método de pago</Cta>
      <Divider />
      <Small>
        Si ya lo resolviste, ignora este correo. Más información en <A href={rootUrl("/ayuda")}>{BRAND.domain}/ayuda</A>.
      </Small>
    </EmailLayout>
  );
}

/** Asunto + cuerpo de cada correo. El asunto es lo que se ve en la bandeja: concreto y sin alarmas. */
export function buildEmail(kind: EmailKind, data: EmailData): { subject: string; element: ReactElement } {
  switch (kind) {
    case "welcome":
      return { subject: `Bienvenido a ${BRAND.name}: tu espacio ${data.tenantName} está listo`, element: <Welcome {...data} /> };
    case "trial_day5":
      return { subject: trialEndingTitle(data.tenantName, data.trialEndsAt, false), element: <TrialEnding {...data} urgent={false} /> };
    case "trial_day7":
      return { subject: trialEndingTitle(data.tenantName, data.trialEndsAt, true), element: <TrialEnding {...data} urgent /> };
    case "trial_expired":
      return { subject: `La prueba de ${data.tenantName} terminó: tu página está en pausa`, element: <TrialExpired {...data} /> };
    case "payment_failed":
      return { subject: `No pudimos cobrar tu suscripción de ${data.tenantName}`, element: <PaymentFailed {...data} /> };
  }
}
