import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listMemberships } from "@/lib/auth/destination";
import { tenantOrigin } from "@/lib/auth/redirects";

export default async function ChooseTenantPage() {
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const host = (await headers()).get("host") ?? "";
  const memberships = await listMemberships(supabase);
  if (memberships.length === 0) redirect("/login?error=sin_tenant");

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl tracking-tight text-foreground">Elige un negocio</h1>
        <ul className="flex flex-col gap-2">
          {memberships.map((m) => (
            <li key={m.slug}>
              <a
                href={`${tenantOrigin(m.slug, host)}/panel`}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm hover:bg-surface-hover"
              >
                <span className="text-foreground">{m.name}</span>
                <span className="text-xs text-muted">{m.slug}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
