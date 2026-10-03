import { headers } from "next/headers";
import { requireOperableTenant } from "@/lib/tenant-page";
import { tenantOrigin } from "@/lib/auth/redirects";
import { CatalogBrowser } from "@/components/storefront/catalog-browser";
import { ShareButton } from "@/components/storefront/share-button";
import { buttonVariants } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { whatsappHref, type CatalogItem } from "@/lib/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn, formatCurrency } from "@/lib/utils";
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
      .select("id, title, description, category, price, unit, images, sku")
      .eq("tenant_id", tenant.id)
      .in("kind", ["product", "service"])
      .eq("status", "available")
      .order("sort", { ascending: true })
      .order("title", { ascending: true }),
  ]);
  const properties = (data ?? []).map(itemToProperty);

  const catalogItems: CatalogItem[] = (catalogData ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: Number(row.price),
    unit: row.unit,
    images: row.images ?? [],
    sku: row.sku,
  }));
  const categoryCount = new Set(catalogItems.map((i) => i.category ?? "General")).size;

  const host = (await headers()).get("host") ?? "";
  const catalogUrl = tenantOrigin(slug, host);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-32 pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[40px] tracking-[-0.01em] text-ink sm:text-[56px]">{tenant.name}</h1>
          <p className="mt-3 text-[15px] text-ink-2">
            {properties.length > 0
              ? `${properties.length} unidades en cartera.`
              : catalogItems.length > 0
                ? `${catalogItems.length} ${catalogItems.length === 1 ? "producto o servicio" : "productos y servicios"}${categoryCount > 1 ? ` en ${categoryCount} categorías` : ""}.`
                : "Aún no hay nada publicado."}
          </p>
        </div>
        {properties.length > 0 || catalogItems.length > 0 ? (
          <div className="flex gap-2 sm:gap-3">
            <ShareButton url={catalogUrl} title={tenant.name} />
            <a
              href={whatsappHref(tenant.whatsapp, `Hola, vi el catálogo de ${tenant.name} (${catalogUrl}) y quiero hacer una consulta.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              <span className="sm:hidden">WhatsApp</span>
              <span className="hidden sm:inline">Escribir por WhatsApp</span>
            </a>
          </div>
        ) : null}
      </div>

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

      {catalogItems.length > 0 ? (
        <div className={properties.length > 0 ? "mt-12" : "mt-8"}>
          <CatalogBrowser slug={slug} items={catalogItems} accent={tenant.brand_color} />
        </div>
      ) : null}
    </div>
  );
}
