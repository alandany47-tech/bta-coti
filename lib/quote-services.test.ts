import { describe, expect, it } from "vitest";
import { buildServicesSnapshot, parseQuoteSnapshot } from "./quote-snapshot";
import { buildQuoteViewModel } from "./quote-view-model";
import { priceServices } from "./services-pricing";

const pricing = priceServices(
  [
    { itemId: "a", title: "Instalación", unit: "visita", qty: 2, unitPrice: 850, discountPct: 0 },
    { itemId: null, title: "Mano de obra", unit: "hora", qty: 6.5, unitPrice: 350, discountPct: 10 },
  ],
  16,
);
const snapshot = (code?: "clasica" | "moderna" | "editorial") =>
  buildServicesSnapshot({
    quoteId: "abcdef12-0000", tenant: { name: "Plomería Garza", logo_url: null, brand_color: "#2f5d8a", quote_template: code },
    advisorName: null, clientName: "Ana", clientPhone: "5512345678", pricing, notes: null, createdAt: "2026-10-03T12:00:00Z",
  });

describe("cotización de servicios", () => {
  it("el snapshot guarda el desglose por líneas y el total como effectivePrice", () => {
    const s = snapshot();
    expect(s.kind).toBe("services");
    expect(s.property).toBeNull();
    expect(s.breakdown.effectivePrice).toBe(pricing.total);
    expect(parseQuoteSnapshot(JSON.parse(JSON.stringify(s)))?.services?.lines).toHaveLength(2);
  });

  it("una cotización inmobiliaria de antes no trae kind y se lee como property", () => {
    const legacy = JSON.parse(JSON.stringify({ ...snapshot(), kind: undefined, services: undefined }));
    const parsed = parseQuoteSnapshot(legacy);
    expect(parsed?.kind).toBe("property");
    expect(parsed?.services).toBeNull();
  });

  it("un snapshot de servicios sin líneas es inválido", () => {
    expect(parseQuoteSnapshot({ ...JSON.parse(JSON.stringify(snapshot())), services: null })).toBeNull();
  });

  it("el modelo de contenido lista conceptos, subtotal, descuentos, IVA y total; no cambia con la plantilla", () => {
    const m = buildQuoteViewModel(snapshot("clasica"), "AYXCO");
    expect(buildQuoteViewModel(snapshot("editorial"), "AYXCO")).toEqual(m);
    expect(m.kind).toBe("services");
    expect(m.lines.map((l) => [l.title, l.qty, l.total])).toEqual([
      ["Instalación", "2 visita", "$1,700.00"],
      ["Mano de obra", "6.5 hora", "$2,047.50"],
    ]);
    expect(m.lines[1].discount).toBe("− 10 %");
    expect(m.rows.map((r) => r.label)).toEqual(["Subtotal sin descuentos", "Descuentos", "Subtotal", "IVA 16 %"]);
    expect(m.total.value).toBe("$4,347.10");
    expect(m.hasProperty).toBe(false);
    expect(m.stats).toEqual([]);
  });

  it("sin IVA lo dice", () => {
    const m = buildQuoteViewModel({ ...snapshot(), services: priceServices([{ itemId: null, title: "x", unit: null, qty: 1, unitPrice: 100, discountPct: 0 }], 0) }, "AYXCO");
    expect(m.rows.at(-1)).toMatchObject({ label: "IVA", sub: "Precios sin IVA", value: "$0.00" });
  });
});
