/** Constantes y validación de `plans` compartidas entre server (rutas /api/admin/plans) y cliente (PlanForm). */

/** Mismos módulos que `module` en `message_templates` (0018_message_templates.sql). */
export const PLAN_MODULES = ["services", "catalog", "broker"] as const;
export type PlanModule = (typeof PLAN_MODULES)[number];

/** Campos de `plans.limits` (comentario de la columna en 0004_foundation.sql). null = ilimitado. */
export const LIMIT_FIELDS = [
  "items",
  "properties",
  "storage_bytes",
  "users",
  "templates",
  "images_per_item",
  "plans_per_item",
  "quotes_per_day",
] as const;
export type LimitField = (typeof LIMIT_FIELDS)[number];

export type PlanLimits = Partial<Record<LimitField, number | null>>;

export type Plan = {
  id: string;
  code: string;
  name: string;
  price_month: number;
  price_year: number;
  stripe_price_month: string | null;
  stripe_price_year: string | null;
  modules: PlanModule[];
  limits: PlanLimits;
  public: boolean;
  sort: number;
};

const CODE_RE = /^[a-z][a-z0-9_]{1,29}$/;

export type PlanInput = {
  code?: unknown;
  name?: unknown;
  price_month?: unknown;
  price_year?: unknown;
  stripe_price_month?: unknown;
  stripe_price_year?: unknown;
  modules?: unknown;
  limits?: unknown;
  public?: unknown;
  sort?: unknown;
};

export type ValidatedPlan = Omit<Plan, "id">;

function validateLimits(input: unknown): { ok: true; value: PlanLimits } | { ok: false; error: string } {
  const limits: PlanLimits = {};
  if (input && typeof input === "object") {
    for (const field of LIMIT_FIELDS) {
      const raw = (input as Record<string, unknown>)[field];
      if (raw === undefined || raw === null || raw === "") {
        limits[field] = null;
        continue;
      }
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return { ok: false, error: `Límite "${field}" inválido.` };
      limits[field] = Math.floor(num);
    }
  }
  return { ok: true, value: limits };
}

/** Valida un plan nuevo o una edición completa (`code`/`name`/precios obligatorios en ambos casos). */
export function validatePlanInput(input: PlanInput): { ok: true; value: ValidatedPlan } | { ok: false; error: string } {
  const code = String(input.code ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const priceMonth = Number(input.price_month ?? 0);
  const priceYear = Number(input.price_year ?? 0);
  const stripePriceMonth = input.stripe_price_month ? String(input.stripe_price_month).trim() : null;
  const stripePriceYear = input.stripe_price_year ? String(input.stripe_price_year).trim() : null;
  const modulesRaw = Array.isArray(input.modules) ? input.modules : [];
  const isPublic = Boolean(input.public);
  const sort = Number(input.sort ?? 0);

  if (!CODE_RE.test(code)) return { ok: false, error: "El código debe ser minúsculas/números/guion bajo, 2-30 caracteres." };
  if (name.length < 2 || name.length > 60) return { ok: false, error: "El nombre debe tener de 2 a 60 caracteres." };
  if (!Number.isFinite(priceMonth) || priceMonth < 0) return { ok: false, error: "Precio mensual inválido." };
  if (!Number.isFinite(priceYear) || priceYear < 0) return { ok: false, error: "Precio anual inválido." };
  if (!Number.isInteger(sort) || sort < 0) return { ok: false, error: "El orden debe ser un entero ≥ 0." };
  const modules = modulesRaw.filter((m): m is PlanModule => (PLAN_MODULES as readonly string[]).includes(String(m)));
  if (modules.length !== modulesRaw.length) return { ok: false, error: "Módulo inválido." };

  const limits = validateLimits(input.limits);
  if (!limits.ok) return limits;

  return {
    ok: true,
    value: {
      code,
      name,
      price_month: priceMonth,
      price_year: priceYear,
      stripe_price_month: stripePriceMonth,
      stripe_price_year: stripePriceYear,
      modules,
      limits: limits.value,
      public: isPublic,
      sort,
    },
  };
}
