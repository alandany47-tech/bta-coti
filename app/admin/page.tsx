import Link from "next/link";
import { getAdminKpis } from "@/lib/admin-kpis";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatBytes } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

export default async function AdminResumenPage() {
  const kpis = await getAdminKpis();
  const conversionPct = kpis.trialConversion30d
    ? Math.round((kpis.trialConversion30d.converted / kpis.trialConversion30d.total) * 100)
    : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>MRR</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{formatCurrency(kpis.mrr)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clientes activos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{kpis.activeCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>En prueba</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{kpis.trialingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Morosos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{kpis.pastDueCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversión de prueba (30 días)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {conversionPct === null ? "—" : `${conversionPct}%`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Almacenamiento total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatBytes(kpis.storageBytesTotal)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pruebas que vencen en ≤ 2 días</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 p-0">
            {kpis.trialsEndingSoon.length === 0 ? (
              <p className="p-4 text-sm text-muted">Ninguna por ahora.</p>
            ) : (
              kpis.trialsEndingSoon.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/admin/clientes?q=${encodeURIComponent(tenant.slug)}`}
                  className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-sm first:border-t-0 hover:bg-surface-hover"
                >
                  <span className="text-foreground">{tenant.name}</span>
                  <span className="text-muted">{dateFormat.format(new Date(tenant.trial_ends_at))}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pagos fallidos recientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 p-0">
            {kpis.recentPastDue.length === 0 ? (
              <p className="p-4 text-sm text-muted">Ninguno por ahora.</p>
            ) : (
              kpis.recentPastDue.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/admin/clientes?q=${encodeURIComponent(tenant.slug)}`}
                  className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-sm first:border-t-0 hover:bg-surface-hover"
                >
                  <span className="text-foreground">{tenant.name}</span>
                  <span className="text-muted">
                    {tenant.status_changed_at ? dateFormat.format(new Date(tenant.status_changed_at)) : "—"}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
