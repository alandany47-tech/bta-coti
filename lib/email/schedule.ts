/** Cuándo toca cada aviso de la prueba (T25). Funciones puras: las usa el cron y se prueban sin base. */

const DAY = 24 * 60 * 60 * 1000;

export type TrialReminderKind = "trial_day5" | "trial_day7";

/**
 * Prueba de 7 días: el aviso "día 5" sale cuando faltan 3 días o menos y el "día 7" cuando falta 1
 * o menos. Si el cron estuvo caído y ya falta poco, solo sale el más urgente (nunca los dos juntos).
 * Null si ya venció (de eso se encarga el correo de "vencida") o todavía falta mucho.
 */
export function trialReminderKind(trialEndsAt: Date, now: Date): TrialReminderKind | null {
  const left = trialEndsAt.getTime() - now.getTime();
  if (left <= 0) return null;
  if (left <= DAY) return "trial_day7";
  if (left <= 3 * DAY) return "trial_day5";
  return null;
}

/** El correo de "vencida" solo se manda a pruebas que vencieron hace poco (no a las de antes de T25). */
export const EXPIRED_EMAIL_WINDOW_MS = 3 * DAY;

/** Ventana de consulta del cron: pruebas que vencen en los próximos 3 días. */
export const REMINDER_LOOKAHEAD_MS = 3 * DAY;
