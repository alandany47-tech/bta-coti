import { createHash, randomBytes } from "node:crypto";

/** Equipo del negocio (T33). Roles asignables: el dueño es uno solo y no se invita (0035). */
export const TEAM_ROLES = ["editor", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_LABEL: Record<TeamRole | "owner", string> = { owner: "Dueño", editor: "Editor", viewer: "Vendedor" };

export const ROLE_HELP: Record<TeamRole | "owner", string> = {
  owner: "Administra el equipo, la facturación y todo lo demás.",
  editor: "Cotiza y edita catálogo, plantillas, mensajes y datos del negocio.",
  viewer: "Solo cotiza y ve las cotizaciones. No cambia nada del negocio.",
};

export const isTeamRole = (value: unknown): value is TeamRole => TEAM_ROLES.includes(value as TeamRole);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function normalizeInviteEmail(raw: unknown): string | null {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** Token de invitación: 32 bytes aleatorios; en la base solo vive su SHA-256 (si se filtra la tabla, no sirve para entrar). */
export function newInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Traduce los errores de las funciones de 0035 a un mensaje para el dueño. */
export function teamErrorResponse(message: string | undefined): { status: number; error: string } {
  const m = message ?? "";
  if (m.includes("user_quota_exceeded")) {
    return { status: 409, error: "Tu plan ya no tiene lugares libres. Cambia de plan para sumar más personas." };
  }
  if (m.includes("already_member")) return { status: 409, error: "Esa persona ya está en tu equipo." };
  if (m.includes("invalid_email")) return { status: 400, error: "Escribe un correo válido." };
  if (m.includes("invalid_role")) return { status: 400, error: "Rol inválido." };
  if (m.includes("cannot_modify_owner")) return { status: 400, error: "El dueño no se puede cambiar ni quitar." };
  if (m.includes("member_not_found")) return { status: 404, error: "Esa persona ya no está en el equipo." };
  if (m.includes("demo_readonly")) return { status: 403, error: "En la demo no se puede administrar el equipo." };
  if (m.includes("not_authorized")) return { status: 403, error: "Solo el dueño administra el equipo." };
  return { status: 500, error: "No se pudo completar la acción." };
}

export type TeamOverview = {
  /** `plans.limits.users` efectivo (en prueba manda el tope de prueba); null = sin límite. */
  limit: number | null;
  members: { user_id: string; email: string; role: "owner" | TeamRole; created_at: string; last_sign_in_at: string | null }[];
  invitations: { id: string; email: string; role: TeamRole; created_at: string; expires_at: string }[];
};
