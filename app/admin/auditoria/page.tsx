import Link from "next/link";
import { listAuditLogForAdmin } from "@/lib/admin-audit";
import { AuditFiltros } from "@/components/admin/audit-filtros";
import { Pagination } from "@/components/ui/pagination";

const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total, pageSize } = await listAuditLogForAdmin({ q: sp.q, page });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AuditFiltros basePath="/admin/auditoria" initialQ={sp.q ?? ""} />
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-left">
          <thead className="border-b border-border-subtle text-xs text-muted">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Negocio</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-muted">
                  Sin registros.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle last:border-0">
                  <td className="p-3 text-sm text-foreground-muted tabular">{dateFormat.format(new Date(row.createdAt))}</td>
                  <td className="p-3 text-sm font-medium text-foreground">{row.action}</td>
                  <td className="p-3 text-sm text-foreground-muted">
                    {row.tenant ? (
                      <Link href={`/admin/clientes/${row.tenant.id}`} className="hover:underline">
                        {row.tenant.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-sm text-foreground-muted">{row.actorEmail ?? "Automático"}</td>
                  <td className="p-3 text-xs text-muted">
                    {Object.keys(row.payload).length === 0 ? (
                      "—"
                    ) : (
                      <details>
                        <summary className="cursor-pointer">Ver</summary>
                        <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(row.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/auditoria" query={{ q: sp.q }} label="registros" />
    </div>
  );
}
