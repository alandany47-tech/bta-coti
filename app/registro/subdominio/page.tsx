import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/auth/destination";
import { parsePendingTenant } from "@/lib/auth/register-schema";
import { ChooseSlugForm } from "@/components/auth/register-form";

export default async function ChooseSlugPage() {
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/registro/subdominio");

  const pending = parsePendingTenant(user.user_metadata?.pending_tenant);
  if (!pending) {
    const host = (await headers()).get("host") ?? "";
    redirect(await resolveDestination(supabase, host));
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl tracking-tight text-foreground">Elige otro subdominio</h1>
        <p className="mb-6 text-center text-sm text-muted">
          El que escogiste para «{pending.name}» ya lo tomó alguien más. Tu cuenta está confirmada; solo
          falta la dirección.
        </p>
        <ChooseSlugForm suggestion={`${pending.slug}-2`} />
      </div>
    </div>
  );
}
