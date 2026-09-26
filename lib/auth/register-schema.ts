export const GIROS = {
  servicios: { label: "Servicios", plan: "esencial" },
  catalogo: { label: "Catálogo", plan: "catalogo" },
  broker: { label: "Broker inmobiliario", plan: "broker" },
} as const;

export type Giro = keyof typeof GIROS;

export const SELF_SIGNUP_PLANS: readonly string[] = Object.values(GIROS).map((g) => g.plan);

export const SLUG_RE = /^[a-z0-9](-?[a-z0-9]){2,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type PendingTenant = { name: string; slug: string; plan_code: string };

export type RegistrationInput = {
  business: string;
  giro: string;
  slug: string;
  fullName: string;
  email: string;
  password: string;
};

export type RegistrationValue = PendingTenant & { fullName: string; email: string; password: string };

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

export function normalizeSlugInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugError(slug: string): string | null {
  return SLUG_RE.test(slug) ? null : "Usa de 3 a 30 letras minúsculas, números o guiones (sin guion al inicio ni al final).";
}

export function validateRegistration(
  input: RegistrationInput,
): { ok: true; value: RegistrationValue } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const business = input.business.trim().replace(/\s+/g, " ");
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const slug = normalizeSlugInput(input.slug);

  if (business.length < 2 || business.length > 80) errors.business = "Escribe el nombre de tu negocio (2 a 80 caracteres).";
  if (!(input.giro in GIROS)) errors.giro = "Elige el giro de tu negocio.";
  const slugProblem = slugError(slug);
  if (slugProblem) errors.slug = slugProblem;
  if (fullName.length < 2 || fullName.length > 80) errors.fullName = "Escribe tu nombre (2 a 80 caracteres).";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Escribe un correo válido.";
  if (input.password.length < 8) errors.password = "La contraseña debe tener al menos 8 caracteres.";
  else if (input.password.length > 72) errors.password = "La contraseña no puede pasar de 72 caracteres.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: business,
      slug,
      plan_code: GIROS[input.giro as Giro].plan,
      fullName,
      email,
      password: input.password,
    },
  };
}

/** `pending_tenant` viaja en user_metadata, que el propio usuario puede escribir: se revalida siempre. */
export function parsePendingTenant(raw: unknown): PendingTenant | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, slug, plan_code } = raw as Record<string, unknown>;
  if (typeof name !== "string" || typeof slug !== "string" || typeof plan_code !== "string") return null;
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 80) return null;
  if (!SLUG_RE.test(slug)) return null;
  if (!SELF_SIGNUP_PLANS.includes(plan_code)) return null;
  return { name: cleanName, slug, plan_code };
}
