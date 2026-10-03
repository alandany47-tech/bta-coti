import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { buildEmail, formatTrialEnd, type EmailKind } from "./templates";

const data = { tenantName: "Muebles Nogal", slug: "muebles-nogal", trialEndsAt: "2026-10-09T18:00:00Z" };
const kinds: EmailKind[] = ["welcome", "trial_day5", "trial_day7", "trial_expired", "payment_failed"];

describe("plantillas de correo", () => {
  for (const kind of kinds) {
    it(`${kind}: asunto con el negocio, enlace al subdominio y sin variables sin resolver`, async () => {
      const { subject, element } = buildEmail(kind, data);
      const html = await render(element);
      const text = await render(element, { plainText: true });
      expect(subject).toContain("Muebles Nogal");
      expect(html).toContain("muebles-nogal.");
      expect(html).toContain('lang="es-MX"');
      expect(html + text).not.toMatch(/undefined|\{\w+\}|\[object/);
      expect(text.length).toBeGreaterThan(80);
    });
  }

  it("la bienvenida y los avisos dicen cuándo termina la prueba", async () => {
    const html = await render(buildEmail("trial_day5", data).element);
    expect(html).toMatch(/viernes, 9 de octubre/);
  });

  it("formatTrialEnd tolera fechas ausentes o inválidas", () => {
    expect(formatTrialEnd(null)).toBeNull();
    expect(formatTrialEnd("nope")).toBeNull();
  });
});
