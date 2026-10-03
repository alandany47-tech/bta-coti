import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { requireOperableTenant } from "@/lib/tenant-page";
import { getTenantBySlug } from "@/lib/tenants";
import { tenantOrigin } from "@/lib/auth/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildItemMessage, whatsappHref } from "@/lib/catalog";
import { AddButton } from "@/components/storefront/add-button";
import { Gallery } from "@/components/storefront/gallery";
import { ShareButton } from "@/components/storefront/share-button";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

type Params = Promise<{ tenant: string; itemId: string }>;

/** Una sola consulta por request: la comparten `generateMetadata` y la página. */
const getItem = cache(async (tenantId: string, itemId: string) => {
  const { data } = await createServerSupabaseClient()
    .from("items")
    .select("id, title, description, category, price, unit, images, sku, attrs, kind")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .in("kind", ["product", "service"])
    .eq("status", "available")
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, itemId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return {};
  const item = await getItem(tenant.id, itemId);
  if (!item) return {};

  const description = item.description?.slice(0, 160) ?? `${formatCurrency(Number(item.price))} · ${tenant.name}`;
  return {
    title: { absolute: `${item.title} · ${tenant.name}` },
    description,
    // Los sitios en prueba no se indexan (ABUSE-AND-LIMITS §3.3), igual que la portada.
    robots: tenant.status === "trialing" ? { index: false, follow: false } : undefined,
    // La foto del producto es lo que se ve al pegar el enlace en WhatsApp.
    openGraph: {
      title: item.title,
      description,
      siteName: tenant.name,
      images: item.images?.[0] ? [{ url: item.images[0] }] : undefined,
    },
  };
}

export default async function ItemPage({ params }: { params: Params }) {
  const { tenant: slug, itemId } = await params;
  const tenant = await requireOperableTenant(slug);
  const item = await getItem(tenant.id, itemId);
  if (!item) notFound();

  const host = (await headers()).get("host") ?? "";
  const origin = tenantOrigin(slug, host);
  const itemUrl = `${origin}/i/${item.id}`;
  const price = Number(item.price);
  const attrs = Object.entries((item.attrs ?? {}) as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-32 pt-6 sm:pt-10">
      <Link href="/" className="inline-flex h-9 items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al catálogo
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <Gallery images={item.images ?? []} title={item.title} />

        <div className="lg:pt-2">
          {item.category ? <p className="text-sm text-ink-3">{item.category}</p> : null}
          <h1 className="mt-1 text-[34px] tracking-[-0.01em] text-ink sm:text-[44px]">{item.title}</h1>
          <p className="tabular mt-4 font-display text-[32px] leading-none text-ink">
            {formatCurrency(price)}
            {item.unit ? <span className="ml-2 font-sans text-[15px] text-ink-3">por {item.unit}</span> : null}
          </p>

          {item.description ? (
            <p className="mt-6 max-w-prose whitespace-pre-line text-[16px] leading-relaxed text-ink-2">{item.description}</p>
          ) : null}

          {attrs.length > 0 ? (
            <dl className="mt-6 divide-y divide-line border-y border-line text-[15px]">
              {attrs.map(([name, value]) => (
                <div key={name} className="flex justify-between gap-6 py-3">
                  <dt className="text-ink-3">{name}</dt>
                  <dd className="text-right text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-8 flex flex-col gap-3">
            <AddButton slug={slug} size="lg" item={{ id: item.id, title: item.title, price, unit: item.unit }} />
            <a
              href={whatsappHref(tenant.whatsapp, buildItemMessage({ businessName: tenant.name, title: item.title, price, itemUrl }))}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Consultar por WhatsApp
            </a>
            <div className="flex items-center justify-between pt-1">
              {item.sku ? <p className="text-[13px] text-ink-3">Código {item.sku}</p> : <span />}
              <ShareButton url={itemUrl} title={item.title} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
