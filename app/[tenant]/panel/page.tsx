import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getTenantBySlug } from "@/lib/tenants";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";

// Provisional: T03 reemplaza esta página por el panel real del tenant.
export default async function PanelPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const host = (await headers()).get("host") ?? "";
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `${tenantOrigin(slug, host)}/panel`;
    redirect(`${rootOrigin(host)}/login?next=${encodeURIComponent(next)}`);
  }

  const { data: isMember } = await supabase.rpc("is_member", { p_tenant_id: tenant.id });
  if (!isMember) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl tracking-tight text-foreground">{tenant.name}</h1>
      <p className="mt-2 text-sm text-muted">Sesión iniciada como {user.email}. El panel llega en el siguiente ticket.</p>
      <form action={`${rootOrigin(host)}/auth/logout`} method="post" className="mt-6">
        <button type="submit" className="text-sm text-muted underline hover:text-foreground">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
