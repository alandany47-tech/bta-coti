import { normalizeSlugInput, slugError } from "@/lib/auth/register-schema";

export const ADMIN_PLANS = ["esencial", "catalogo", "broker", "broker_pro"] as const;

export type NewClientInput = {
  name?: unknown;
  slug?: unknown;
  ownerEmail?: unknown;
  plan?: unknown;
  status?: unknown;
  trialDays?: unknown;
  billingMode?: unknown;
  notes?: unknown;
};

export type NewClient = {
  name: string;
  slug: string;
  ownerEmail: string;
  plan: (typeof ADMIN_PLANS)[number];
  status: "trialing" | "active";
  trialDays: number;
  billingMode: "stripe" | "manual";
  notes: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type CloneProspectInput = { name?: unknown; slug?: unknown; ownerEmail?: unknown };
export type CloneProspect = { name: string; slug: string; ownerEmail: string };

/** Validación de "Clonar demo como prospecto-x" (docs/DEMO.md §4): mismas reglas que el nombre/slug/correo del alta manual. */
export function validateCloneProspect(
  input: CloneProspectInput,
): { ok: true; value: CloneProspect } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  const slug = normalizeSlugInput(String(input.slug ?? ""));
  const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();

  if (name.length < 2 || name.length > 80) return { ok: false, error: "El nombre debe tener de 2 a 80 caracteres." };
  const slugProblem = slugError(slug);
  if (slugProblem) return { ok: false, error: slugProblem };
  if (!EMAIL_RE.test(ownerEmail) || ownerEmail.length > 254) return { ok: false, error: "Correo del dueño inválido." };

  return { ok: true, value: { name, slug, ownerEmail } };
}

export function validateNewClient(
  input: NewClientInput,
): { ok: true; value: NewClient } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  const slug = normalizeSlugInput(String(input.slug ?? ""));
  const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
  const plan = String(input.plan ?? "");
  const status = String(input.status ?? "trialing");
  const billingMode = String(input.billingMode ?? "stripe");
  const trialDays = Number(input.trialDays ?? 7);
  const notes = String(input.notes ?? "").trim().slice(0, 5000) || null;

  if (name.length < 2 || name.length > 80) return { ok: false, error: "El nombre debe tener de 2 a 80 caracteres." };
  const slugProblem = slugError(slug);
  if (slugProblem) return { ok: false, error: slugProblem };
  if (!EMAIL_RE.test(ownerEmail) || ownerEmail.length > 254) return { ok: false, error: "Correo del dueño inválido." };
  if (!(ADMIN_PLANS as readonly string[]).includes(plan)) return { ok: false, error: "Plan inválido." };
  if (status !== "trialing" && status !== "active") return { ok: false, error: "El estado inicial debe ser prueba o activo." };
  if (billingMode !== "stripe" && billingMode !== "manual") return { ok: false, error: "Modo de cobro inválido." };
  if (status === "trialing" && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90)) {
    return { ok: false, error: "Los días de prueba deben ser un entero de 1 a 90." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      ownerEmail,
      plan: plan as NewClient["plan"],
      status,
      trialDays: status === "trialing" ? trialDays : 0,
      billingMode,
      notes,
    },
  };
}
