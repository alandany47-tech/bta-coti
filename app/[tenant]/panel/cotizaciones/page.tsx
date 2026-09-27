import { headers } from "next/headers";
import { CopyLinkButton } from "@/components/quote/copy-link-button";
import { getPanelContext } from "@/lib/auth/panel";
import { tenantOrigin } from "@/lib/auth/redirects";
import { formatCurrency } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};

const dateTime = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

export default async function QuotesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant } = await getPanelContext(slug);
  const origin = tenantOrigin(slug, (await headers()).get("host") ?? "");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, number, client_name, total_amount, status, views, last_viewed_at, created_at, expires_at, share_token, snapshot")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl">Cotizaciones</h1>
      {quotes && quotes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-3">
              <tr>
                <th className="p-3 font-medium">Folio</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Propiedad</th>
                <th className="p-3 text-right font-medium">Total</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 text-center font-medium">Vistas</th>
                <th className="p-3 font-medium">Enlace</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const property = (quote.snapshot as { property?: { title?: string } } | null)?.property?.title;
                const url = `${origin}/q/${quote.share_token}`;
                return (
                  <tr key={quote.id} className="border-b border-line last:border-b-0">
                    <td className="tabular p-3 text-ink-2">#{String(quote.number).padStart(4, "0")}</td>
                    <td className="p-3 text-ink">{quote.client_name}</td>
                    <td className="p-3 text-ink-2">{property ?? "—"}</td>
                    <td className="tabular p-3 text-right text-ink">{formatCurrency(Number(quote.total_amount))}</td>
                    <td className="p-3 text-ink-2">{STATUS_LABEL[quote.status] ?? quote.status}</td>
                    <td
                      className="tabular p-3 text-center text-ink-2"
                      title={quote.last_viewed_at ? `Última vista: ${dateTime.format(new Date(quote.last_viewed_at))}` : "Sin vistas"}
                    >
                      {quote.views}
                    </td>
                    <td className="flex gap-3 p-3">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Abrir
                      </a>
                      <CopyLinkButton url={url} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-2">Aún no hay cotizaciones. Genera la primera desde el cotizador.</p>
      )}
    </div>
  );
}
