import Link from "next/link";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { BRAND } from "@/lib/brand";

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default async function WelcomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant, role } = await getPanelContext(slug);
  const days = tenant.status === "trialing" ? daysLeft(tenant.trial_ends_at) : null;
  const ends = tenant.trial_ends_at
    ? new Date(tenant.trial_ends_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl tracking-tight text-foreground">Bienvenido a {BRAND.name}</h1>
      <p className="mt-3 text-foreground-muted">
        Tu espacio <span className="font-medium text-foreground">{tenant.name}</span> ya está listo.
        {days !== null && ends ? ` Tu prueba dura ${days} ${days === 1 ? "día" : "días"} más y termina el ${ends}.` : null}
      </p>

      <ol className="mt-8 divide-y divide-border-subtle border-y border-border-subtle text-sm">
        {hasRole(role, "editor") ? (
          <li className="flex items-center justify-between gap-4 py-4">
            <span>
              <span className="block font-medium text-foreground">Carga tu cartera</span>
              <span className="text-muted">Importa un Excel o agrega tus propiedades una por una.</span>
            </span>
            <Link href="/panel/importar" className="shrink-0 underline hover:text-foreground">
              Importar
            </Link>
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-4 py-4">
          <span>
            <span className="block font-medium text-foreground">Haz tu primera cotización</span>
            <span className="text-muted">Elige una propiedad, ajusta el enganche y envíala por WhatsApp.</span>
          </span>
          <Link href="/panel" className="shrink-0 underline hover:text-foreground">
            Cotizar
          </Link>
        </li>
      </ol>
    </div>
  );
}
