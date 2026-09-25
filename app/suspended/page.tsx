import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

function buildSupportWhatsAppUrl(tenantName: string | null) {
  const digits = SUPPORT_WHATSAPP.replace(/[^\d]/g, "");
  const message = tenantName
    ? `Hola, soy administrador de "${tenantName}" en ${BRAND.name}. Mi cuenta aparece suspendida y quisiera reactivarla.`
    : `Hola, mi cuenta en ${BRAND.name} aparece suspendida y quisiera reactivarla.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: slug } = await searchParams;

  let tenantName: string | null = null;
  if (slug) {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("tenants")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    tenantName = data?.name ?? null;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface p-8 text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>

        {tenantName ? (
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">
            {tenantName}
          </p>
        ) : null}

        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Acceso Temporalmente Suspendido
        </h1>
        <p className="mt-3 text-sm text-foreground-muted">
          Esta cuenta se encuentra suspendida por falta de pago o
          mantenimiento del servicio.
        </p>

        {SUPPORT_WHATSAPP ? (
          <a
            href={buildSupportWhatsAppUrl(tenantName)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground-muted"
          >
            Contactar a soporte por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
