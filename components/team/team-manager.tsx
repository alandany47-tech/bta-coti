"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_HELP, ROLE_LABEL, TEAM_ROLES, type TeamOverview, type TeamRole } from "@/lib/team";

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
const selectClass =
  "h-10 rounded-md border border-border-subtle bg-surface px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted";

/** Panel → Equipo (solo dueño): lugares del plan, invitar, cambiar rol, quitar y reenviar. */
export function TeamManager({
  tenantSlug,
  overview,
  currentUserId,
  isDemo,
  isTrial,
}: {
  tenantSlug: string;
  overview: TeamOverview;
  currentUserId: string;
  isDemo: boolean;
  isTrial: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const used = overview.members.length + overview.invitations.length;
  const full = overview.limit !== null && used >= overview.limit;

  async function call(key: string, url: string, init: RequestInit, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar la acción.");
        return false;
      }
      if (done) setNotice(done);
      router.refresh();
      return true;
    } catch {
      setError("Error de red. Intenta de nuevo.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const ok = await call("invite", `/api/${tenantSlug}/team`, { method: "POST", body: JSON.stringify({ email, role }) }, `Invitación enviada a ${email.trim().toLowerCase()}.`);
    if (ok) setEmail("");
  }

  return (
    <div className="flex flex-col gap-8">
      {isDemo ? (
        <p className="rounded-md border border-line bg-sunken px-4 py-3 text-sm text-ink-2">
          Esta es la demo: puedes ver cómo se administra el equipo, pero no se guardan cambios.
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">Invitar a alguien</h2>
          <p className="tabular text-sm text-ink-2">
            {used} de {overview.limit ?? "∞"} {overview.limit === 1 ? "lugar" : "lugares"} ocupados
          </p>
        </div>
        {full ? (
          <p className="text-sm text-ink-2">
            {isTrial
              ? "Durante la prueba el equipo es solo tú. Al elegir un plan podrás sumar más personas."
              : "Tu plan ya no tiene lugares libres. Cambia de plan en Facturación para invitar a más personas."}
          </p>
        ) : null}
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-xs font-medium text-muted">
              Correo
            </label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" required disabled={full} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="text-xs font-medium text-muted">
              Rol
            </label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={selectClass} disabled={full}>
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={full || busy === "invite" || !email.trim()}>
            {busy === "invite" ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar invitación
          </Button>
        </form>
        <p className="text-xs text-ink-3">{ROLE_HELP[role]}</p>
        {notice ? (
          <p role="status" className="text-sm text-ok">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg">Equipo</h2>
        <ul className="flex flex-col gap-2">
          {overview.members.map((m) => {
            const isOwner = m.role === "owner";
            const self = m.user_id === currentUserId;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">
                    {m.email}
                    {self ? <span className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-2">Tú</span> : null}
                  </p>
                  <p className="text-xs text-ink-3">
                    {m.last_sign_in_at ? `Último acceso ${dateFmt.format(new Date(m.last_sign_in_at))}` : "Aún no entra"}
                  </p>
                </div>
                {isOwner ? (
                  <span className="text-sm text-ink-2">{ROLE_LABEL.owner}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Rol de ${m.email}`}
                      value={m.role}
                      onChange={(e) => void call(`role:${m.user_id}`, `/api/${tenantSlug}/team/members/${m.user_id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }, "Rol actualizado.")}
                      disabled={busy === `role:${m.user_id}`}
                      className={selectClass}
                    >
                      {TEAM_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    {confirmRemove === m.user_id ? (
                      <>
                        <Button variant="destructive" size="sm" onClick={async () => { await call(`rm:${m.user_id}`, `/api/${tenantSlug}/team/members/${m.user_id}`, { method: "DELETE" }, "Persona quitada del equipo."); setConfirmRemove(null); }} disabled={busy === `rm:${m.user_id}`}>
                          Sí, quitar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>
                          No
                        </Button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmRemove(m.user_id)} aria-label={`Quitar a ${m.email}`} className="flex h-10 w-10 items-center justify-center rounded-md text-ink-3 hover:text-danger">
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {overview.invitations.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg">Invitaciones pendientes</h2>
          <ul className="flex flex-col gap-2">
            {overview.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{i.email}</p>
                  <p className="text-xs text-ink-3">
                    {ROLE_LABEL[i.role]} · vence el {dateFmt.format(new Date(i.expires_at))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={busy === `re:${i.id}`} onClick={() => void call(`re:${i.id}`, `/api/${tenantSlug}/team`, { method: "POST", body: JSON.stringify({ email: i.email, role: i.role }) }, `Invitación reenviada a ${i.email}.`)}>
                    Reenviar
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy === `rv:${i.id}`} onClick={() => void call(`rv:${i.id}`, `/api/${tenantSlug}/team/invitations/${i.id}`, { method: "DELETE" }, "Invitación cancelada.")}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
