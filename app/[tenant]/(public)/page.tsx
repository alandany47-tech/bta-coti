import { requireOperableTenant } from "@/lib/tenant-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";
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

type CatalogItemRow = {
  id: string;
  title: string;
  category: string | null;
  price: number | string;
  unit: string | null;
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await requireOperableTenant(slug);

  const supabase = createServerSupabaseClient();
  const [{ data }, { data: catalogData }] = await Promise.all([
    supabase
      .from("items")
      .select(PROPERTY_COLUMNS)
      .eq("tenant_id", tenant.id)
      .eq("kind", "property")
      .order("sku", { ascending: true }),
    supabase
      .from("items")
      .select("id, title, category, price, unit")
      .eq("tenant_id", tenant.id)
      .in("kind", ["product", "service"])
      .eq("status", "available")
      .order("category", { ascending: true })
      .order("title", { ascending: true }),
  ]);
  const properties = (data ?? []).map(itemToProperty);

  const catalogItems = (catalogData ?? []) as CatalogItemRow[];
  const catalogByCategory = new Map<string, CatalogItemRow[]>();
  for (const item of catalogItems) {
    const key = item.category ?? "General";
    const group = catalogByCategory.get(key) ?? [];
    group.push(item);
    catalogByCategory.set(key, group);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl tracking-tight text-foreground">{tenant.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {properties.length > 0
          ? `${properties.length} unidades en cartera.`
          : catalogItems.length > 0
            ? `${catalogItems.length} productos y servicios.`
            : "Aún no hay nada publicado."}
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

      {catalogByCategory.size > 0 ? (
        <div className="mt-8 flex flex-col gap-8">
          {[...catalogByCategory.entries()].map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{category}</h2>
              <ul className="mt-2 divide-y divide-border-subtle border-y border-border-subtle">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <p className="text-foreground">{item.title}</p>
                    <p className="tabular shrink-0 text-sm font-medium text-foreground">
                      {formatCurrency(Number(item.price))}
                      {item.unit ? <span className="ml-1 font-normal text-foreground-muted">/{item.unit}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
