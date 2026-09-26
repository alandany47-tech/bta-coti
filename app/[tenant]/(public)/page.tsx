import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Property } from "@/lib/types";

const STATUS_LABEL: Record<Property["status"], string> = {
  available: "Disponible",
  reserved: "Apartado",
  sold: "Vendido",
};

const STATUS_DOT: Record<Property["status"], string> = {
  available: "bg-ok",
  reserved: "bg-warn",
  sold: "bg-danger",
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("unit_number", { ascending: true });
  const properties = (data ?? []) as Property[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl tracking-tight text-foreground">{tenant.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {properties.length > 0
          ? `${properties.length} unidades en cartera.`
          : "Aún no hay propiedades publicadas."}
      </p>

      {properties.length > 0 ? (
        <ul className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
          {properties.map((property) => (
            <li key={property.id} className="flex items-center gap-4 py-4">
              {property.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={property.images[0]}
                  alt={property.title}
                  width={72}
                  height={56}
                  className="h-14 w-[72px] rounded-md object-cover"
                />
              ) : (
                <div className="h-14 w-[72px] rounded-md bg-surface-hover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{property.title}</p>
                <p className="text-xs text-muted">
                  Unidad {property.unit_number} · {property.m2_total} m² · {property.parking_spaces}{" "}
                  {property.parking_spaces === 1 ? "cajón" : "cajones"}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-medium text-foreground">
                  {formatCurrency(property.list_price)}
                </p>
                <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-foreground-muted">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[property.status]}`} />
                  {STATUS_LABEL[property.status]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
