import { describe, expect, it } from "vitest";
import { calculatePricing } from "./pricing";
import { buildQuoteSnapshot, parseQuoteSnapshot } from "./quote-snapshot";
import { buildQuoteViewModel } from "./quote-view-model";
import { accentTextColor, getQuoteTemplate, isQuoteTemplateCode, QUOTE_TEMPLATES, readableOn, safeBrandColor, templateIncludedInPlan } from "./quote-templates";
import type { Property } from "./types";

const property: Property = {
  id: "p1", tenant_id: "t1", title: "Torre Zafiro", unit_number: "A-402", m2_interior: 85.5, m2_exterior: 12, m2_total: 97.5,
  parking_spaces: 2, list_price: 3_500_000, images: ["https://cdn/1.webp"], floor_plan_url: "https://cdn/plano.webp",
  status: "available", created_at: "x", updated_at: "x",
};
const breakdown = calculatePricing({ listPrice: 3_500_000, discountPct: 5, downPaymentPct: 20, installmentsCount: 24, finalPaymentPct: 10 });
const snapshot = (templateCode?: string) =>
  buildQuoteSnapshot({
    quoteId: "abcdef12-0000", tenant: { name: "Zafiro", logo_url: null, brand_color: "#b4532a", quote_template: (templateCode ?? "clasica") as never },
    advisorName: "Ana", clientName: "Luis", clientPhone: "5512345678", property, breakdown, installmentsCount: 24, notes: "Vigencia 30 días", createdAt: "2026-10-03T12:00:00Z",
  });

describe("plantillas base", () => {
  it("son tres, con códigos únicos y colores hex válidos", () => {
    expect(QUOTE_TEMPLATES.map((t) => t.code)).toEqual(["clasica", "moderna", "editorial"]);
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const t of QUOTE_TEMPLATES) {
      for (const c of [...Object.values(t.colors), ...Object.values(t.sheet2)]) expect(c).toMatch(hex);
    }
  });

  it("un código desconocido cae en la clásica", () => {
    expect(getQuoteTemplate("nope").code).toBe("clasica");
    expect(isQuoteTemplateCode("moderna")).toBe(true);
    expect(isQuoteTemplateCode("premium")).toBe(false);
  });

  it("el límite del plan deja usar las primeras N (null = todas)", () => {
    expect(templateIncludedInPlan("clasica", 1)).toBe(true);
    expect(templateIncludedInPlan("moderna", 1)).toBe(false);
    expect(templateIncludedInPlan("moderna", 2)).toBe(true);
    expect(templateIncludedInPlan("editorial", 2)).toBe(false);
    expect(templateIncludedInPlan("editorial", null)).toBe(true);
  });

  it("el texto sobre el color de marca es legible tanto con marcas oscuras como claras", () => {
    expect(readableOn("#b4532a")).toBe("#FFFFFF");
    expect(readableOn("#18181B")).toBe("#FFFFFF");
    expect(readableOn("#F4E6DE")).toBe("#1A1917");
    expect(readableOn("#FFD60A")).toBe("#1A1917");
    expect(safeBrandColor("rojo")).toBe("#18181B");
    expect(accentTextColor("#b4532a", "#1A1917")).toBe("#b4532a");
    expect(accentTextColor("#FFD60A", "#1A1917")).toBe("#1A1917");
  });
});

describe("modelo de contenido (lo que comparten web y PDF)", () => {
  it("los montos salen del snapshot y no dependen de la plantilla", () => {
    const a = buildQuoteViewModel(snapshot("clasica"), "AYXCO");
    const b = buildQuoteViewModel(snapshot("editorial"), "AYXCO");
    expect(b).toEqual(a);
    expect(a.total.value).toBe("$3,325,000.00");
    expect(a.rows.map((r) => r.label)).toEqual(["Precio de lista", "Descuento aplicado", "Enganche", "Mensualidades", "Saldo a escrituración"]);
  });

  it("arma folio, características y plano; omite lo que no aplica", () => {
    const m = buildQuoteViewModel(snapshot(), "AYXCO");
    expect(m.folio).toBe("ABCDEF12");
    expect(m.stats.map((s) => s.label)).toEqual(["Unidad", "M² interiores", "M² exteriores", "M² totales", "Estacionamientos"]);
    expect(m.floorPlanUrl).toBe("https://cdn/plano.webp");
    const sinPlano = buildQuoteViewModel({ ...snapshot(), property: { ...property, floor_plan_url: "https://cdn/plano.pdf" } }, "AYXCO");
    expect(sinPlano.floorPlanUrl).toBeNull();
    const sinPropiedad = buildQuoteViewModel({ ...snapshot(), property: null }, "AYXCO");
    expect(sinPropiedad.hasProperty).toBe(false);
    expect(sinPropiedad.stats).toEqual([]);
  });
});

describe("la plantilla en el snapshot", () => {
  it("se congela al crear la cotización", () => {
    expect(snapshot("moderna").templateCode).toBe("moderna");
    expect(parseQuoteSnapshot(JSON.parse(JSON.stringify(snapshot("editorial"))))?.templateCode).toBe("editorial");
  });

  it("una cotización de antes de T31 (sin plantilla) o con un código raro cae en la clásica", () => {
    const legacy = JSON.parse(JSON.stringify(snapshot()));
    delete legacy.templateCode;
    expect(parseQuoteSnapshot(legacy)?.templateCode).toBe("clasica");
    expect(parseQuoteSnapshot({ ...legacy, templateCode: "premium" })?.templateCode).toBe("clasica");
  });
});
