import { describe, expect, it } from "vitest";
import { parseRawLines, parseTaxPct, priceServices, resolveLines, type LineInput } from "./services-pricing";

const line = (over: Partial<LineInput> = {}): LineInput => ({ itemId: null, title: "Servicio", unit: null, qty: 1, unitPrice: 100, discountPct: 0, ...over });
const ID = "11111111-1111-4111-8111-111111111111";

describe("priceServices", () => {
  it("cantidad × precio, descuento por línea e IVA sobre el subtotal", () => {
    const r = priceServices([line({ qty: 3, unitPrice: 1200 }), line({ qty: 1, unitPrice: 500, discountPct: 10 })], 16);
    expect(r.lines.map((l) => l.total)).toEqual([3600, 450]);
    expect(r.discountTotal).toBe(50);
    expect(r.subtotal).toBe(4050);
    expect(r.taxAmount).toBe(648);
    expect(r.total).toBe(4698);
  });

  it("los centavos siempre cuadran (nada de 0.1 + 0.2)", () => {
    const r = priceServices([line({ unitPrice: 0.1 }), line({ unitPrice: 0.2 })], 0);
    expect(r.total).toBe(0.3);
    const x = priceServices([line({ qty: 3, unitPrice: 33.33, discountPct: 7.5 })], 16);
    expect(x.lines[0].gross).toBe(99.99);
    expect(Math.round((x.lines[0].total + x.lines[0].discount) * 100)).toBe(Math.round(x.lines[0].gross * 100));
    expect(Math.round((x.subtotal + x.taxAmount) * 100)).toBe(Math.round(x.total * 100));
  });

  it("IVA en 0 no suma nada y valores locos se acotan", () => {
    expect(priceServices([line()], 0).total).toBe(100);
    const r = priceServices([line({ discountPct: 250, qty: -4 })], 999);
    expect(r.taxPct).toBe(100);
    expect(r.total).toBe(0);
  });

  it("sin líneas el total es cero", () => {
    expect(priceServices([], 16).total).toBe(0);
  });
});

describe("parseRawLines", () => {
  it("acepta ítems por id y conceptos libres, y redondea cantidades", () => {
    const r = parseRawLines([{ itemId: ID, qty: "2.00049", discountPct: "10" }, { itemId: null, title: "  Flete   local ", unitPrice: "350.555", qty: 1 }]);
    expect(r).toEqual({ ok: true, value: [{ itemId: ID, qty: 2, discountPct: 10 }, { itemId: null, qty: 1, discountPct: 0, title: "Flete local", unit: null, unitPrice: 350.56 }] });
  });

  it("ignora cualquier precio que el navegador mande para un ítem del catálogo", () => {
    const r = parseRawLines([{ itemId: ID, qty: 1, unitPrice: 1, title: "x" }]);
    expect(r.ok && r.value[0]).toEqual({ itemId: ID, qty: 1, discountPct: 0 });
  });

  it("rechaza vacío, demasiadas líneas, cantidades y descuentos inválidos", () => {
    expect(parseRawLines([]).ok).toBe(false);
    expect(parseRawLines(Array.from({ length: 51 }, () => ({ itemId: ID, qty: 1 }))).ok).toBe(false);
    expect(parseRawLines([{ itemId: ID, qty: 0 }]).ok).toBe(false);
    expect(parseRawLines([{ itemId: ID, qty: 1, discountPct: 101 }]).ok).toBe(false);
    expect(parseRawLines([{ itemId: "no-es-uuid", qty: 1 }]).ok).toBe(false);
    expect(parseRawLines([{ itemId: null, qty: 1, title: "", unitPrice: 5 }]).ok).toBe(false);
    expect(parseRawLines([{ itemId: null, qty: 1, title: "x", unitPrice: -1 }]).ok).toBe(false);
  });

  it("parseTaxPct", () => {
    expect(parseTaxPct(16)).toEqual({ ok: true, value: 16 });
    expect(parseTaxPct("8")).toEqual({ ok: true, value: 8 });
    expect(parseTaxPct(-1).ok).toBe(false);
    expect(parseTaxPct("abc").ok).toBe(false);
  });
});

describe("resolveLines", () => {
  const catalog = new Map([[ID, { id: ID, title: "Instalación", price: "850.00", unit: "visita" }]]);

  it("los ítems toman precio, nombre y unidad del catálogo", () => {
    const r = resolveLines([{ itemId: ID, qty: 2, discountPct: 0 }], catalog);
    expect(r).toEqual({ ok: true, value: [{ itemId: ID, title: "Instalación", unit: "visita", qty: 2, unitPrice: 850, discountPct: 0 }] });
  });

  it("un ítem que ya no existe se rechaza", () => {
    expect(resolveLines([{ itemId: "22222222-2222-4222-8222-222222222222", qty: 1, discountPct: 0 }], catalog).ok).toBe(false);
  });
});
