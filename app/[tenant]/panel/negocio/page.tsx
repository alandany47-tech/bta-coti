import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ContactForm } from "@/components/panel/contact-form";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { tenantOrigin } from "@/lib/auth/redirects";

export default async function BusinessPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");

  const host = (await headers()).get("host") ?? "";

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Mi negocio</h1>
        <p className="text-sm text-ink-2">Cómo te contactan tus clientes desde tu catálogo público.</p>
      </div>
      <ContactForm
        tenantSlug={slug}
        tenantName={tenant.name}
        initialWhatsapp={tenant.whatsapp}
        catalogUrl={tenantOrigin(slug, host)}
      />
    </div>
  );
}
