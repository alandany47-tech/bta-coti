import { listSubscriptionsForAdmin, listPendingInvoices } from "@/lib/admin-payments";
import { stripeConfigured } from "@/lib/stripe";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  past_due: "Pago vencido",
  canceled: "Cancelada",
  trialing: "En prueba",
  incomplete: "Incompleta",
  unpaid: "Sin pagar",
};

export default async function AdminPagosPage() {
  const [subscriptions, pendingInvoices] = await Promise.all([listSubscriptionsForAdmin(), listPendingInvoices()]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Suscripciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle text-xs text-muted">
              <tr>
                <th className="p-3">Negocio</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Método</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Vencimiento</th>
                <th className="p-3">Cancela al final</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-sm text-muted">
                    Sin suscripciones todavía.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.tenantId} className="border-b border-border-subtle last:border-0">
                    <td className="p-3 text-sm font-medium text-foreground">{sub.tenantName}</td>
                    <td className="p-3 text-sm text-foreground-muted">{sub.planName}</td>
                    <td className="p-3 text-sm text-foreground-muted">
                      {sub.collectionMethod === "send_invoice" ? "SPEI" : "Tarjeta"}
                    </td>
                    <td className="p-3 text-sm text-foreground-muted">{STATUS_LABEL[sub.status] ?? sub.status}</td>
                    <td className="p-3 text-sm text-foreground-muted tabular">
                      {sub.currentPeriodEnd ? dateFormat.format(new Date(sub.currentPeriodEnd)) : "—"}
                    </td>
                    <td className="p-3 text-sm text-foreground-muted">{sub.cancelAtPeriodEnd ? "Sí" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturas SPEI pendientes/vencidas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {!stripeConfigured() ? (
            <p className="p-4 text-sm text-muted">Los pagos no están disponibles todavía.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-border-subtle text-xs text-muted">
                <tr>
                  <th className="p-3">Negocio</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Vencimiento</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Factura</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-sm text-muted">
                      Ninguna pendiente.
                    </td>
                  </tr>
                ) : (
                  pendingInvoices.map((invoice, i) => (
                    <tr key={i} className="border-b border-border-subtle last:border-0">
                      <td className="p-3 text-sm font-medium text-foreground">{invoice.tenantName}</td>
                      <td className="p-3 text-sm text-foreground-muted tabular">
                        {formatCurrency(invoice.amount)} {invoice.currency.toUpperCase()}
                      </td>
                      <td className="p-3 text-sm text-foreground-muted tabular">
                        {invoice.dueDate ? dateFormat.format(new Date(invoice.dueDate)) : "—"}
                      </td>
                      <td className={`p-3 text-sm ${invoice.overdue ? "text-danger" : "text-foreground-muted"}`}>
                        {invoice.overdue ? "Vencida" : "Pendiente"}
                      </td>
                      <td className="p-3 text-sm">
                        {invoice.hostedInvoiceUrl ? (
                          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            Ver
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
