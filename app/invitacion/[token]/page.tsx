import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CreateAccountForm, JoinButton } from "@/components/team/join-forms";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceRoleClient, createSessionSupabaseClient } from "@/lib/supabase/server";
import { hashInvitationToken, ROLE_HELP, ROLE_LABEL, type TeamRole } from "@/lib/team";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Invitación", robots: { index: false, follow: false } };

const MESSAGES: Record<string, string> = {
  expired: "Esta invitación venció. Pídele al dueño del negocio que te mande una nueva.",
  accepted: "Esta invitación ya se usó. Si eres tú, inicia sesión para entrar.",
  revoked: "El dueño canceló esta invitación.",
  inactive: "Este negocio no está disponible por ahora.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          {BRAND.name}
        </p>
        {children}
      </div>
    </div>
  );
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  if (!(await checkRateLimit("login", getClientIp(h))).ok) {
    return <Shell><p className="text-center text-sm text-muted">Demasiados intentos. Espera un minuto.</p></Shell>;
  }

  const { data } = token.length <= 200
    ? await createServiceRoleClient().rpc("invitation_preview", { p_token_hash: hashInvitationToken(token) })
    : { data: null };
  const inv = (data as { tenant_name: string; email: string; role: TeamRole; status: string; user_exists: boolean }[] | null)?.[0];

  if (!inv) {
    return (
      <Shell>
        <h1 className="mb-3 text-center text-2xl">Invitación no válida</h1>
        <p className="text-center text-sm text-muted">El enlace está incompleto o no existe. Pide al dueño que te envíe otro.</p>
      </Shell>
    );
  }
  if (inv.status !== "pending") {
    return (
      <Shell>
        <h1 className="mb-3 text-center text-2xl">Invitación no disponible</h1>
        <p className="text-center text-sm text-muted">{MESSAGES[inv.status] ?? MESSAGES.expired}</p>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-accent hover:underline">Ir a iniciar sesión</Link>
        </p>
      </Shell>
    );
  }

  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionEmail = user?.email?.toLowerCase() ?? null;

  return (
    <Shell>
      <h1 className="mb-2 text-center text-2xl tracking-tight">Te invitaron a {inv.tenant_name}</h1>
      <p className="mb-6 text-center text-sm text-ink-2">
        Entrarás como <strong>{ROLE_LABEL[inv.role]}</strong>. {ROLE_HELP[inv.role]}
      </p>

      {sessionEmail === inv.email ? (
        <JoinButton token={token} />
      ) : sessionEmail ? (
        <div className="flex flex-col gap-3 text-center text-sm text-ink-2">
          <p>
            Tienes sesión como <strong>{sessionEmail}</strong>, pero esta invitación es para <strong>{inv.email}</strong>.
          </p>
          <form action="/auth/logout" method="post">
            <input type="hidden" name="next" value={`/invitacion/${token}`} />
            <button type="submit" className="text-accent hover:underline">Cerrar sesión y continuar</button>
          </form>
        </div>
      ) : inv.user_exists ? (
        <div className="flex flex-col gap-3 text-center text-sm text-ink-2">
          <p>Ya tienes una cuenta con <strong>{inv.email}</strong>. Inicia sesión para aceptar.</p>
          <Link href={`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`} className="inline-flex h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-medium text-background hover:bg-foreground-muted">
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <CreateAccountForm token={token} email={inv.email} />
      )}
    </Shell>
  );
}
