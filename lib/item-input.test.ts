import { describe, expect, it } from "vitest";
import { allowedKindsForModules, attrsToDetails, parseItemInput, parsePrice } from "./item-input";

const both = ["product", "service"] as const;
const base = { kind: "product", title: "  Mesa   de comedor ", price: "$12,500.5", status: "available" };

describe("parseItemInput", () => {
  it("normaliza espacios, precio y campos vacíos", () => {
    const r = parseItemInput({ ...base, description: "  ", details: [{ label: "Material", value: "Nogal" }, { label: "", value: "" }] }, { allowedKinds: both });
    expect(r).toEqual({
      ok: true,
      value: { kind: "product", title: "Mesa de comedor", price: 12500.5, description: null, category: null, unit: null, sku: null, status: "available", attrs: { Material: "Nogal" } },
    });
  });

  it("rechaza tipos que el plan no incluye", () => {
    expect(parseItemInput(base, { allowedKinds: ["service"] })).toMatchObject({ ok: false });
  });

  it("rechaza título vacío, precio negativo y datos a medias o repetidos", () => {
    expect(parseItemInput({ ...base, title: " " }, { allowedKinds: both })).toMatchObject({ ok: false });
    expect(parseItemInput({ ...base, price: -1 }, { allowedKinds: both })).toMatchObject({ ok: false });
    expect(parseItemInput({ ...base, details: [{ label: "Color", value: "" }] }, { allowedKinds: both })).toMatchObject({ ok: false });
    expect(parseItemInput({ ...base, details: [{ label: "A", value: "1" }, { label: "A", value: "2" }] }, { allowedKinds: both })).toMatchObject({ ok: false });
  });

  it("en parcial solo valida lo que llega", () => {
    expect(parseItemInput({ status: "hidden" }, { allowedKinds: both, partial: true })).toEqual({ ok: true, value: { status: "hidden" } });
    expect(parseItemInput({ price: "abc" }, { allowedKinds: both, partial: true })).toMatchObject({ ok: false });
  });
});

describe("parsePrice y módulos", () => {
  it("parsePrice acepta formatos de moneda y redondea a centavos", () => {
    expect(parsePrice("1,250")).toBe(1250);
    expect(parsePrice(10.005)).toBe(10.01);
    expect(parsePrice("")).toBe(0);
    expect(parsePrice("x")).toBeNull();
  });

  it("allowedKindsForModules", () => {
    expect(allowedKindsForModules(["services"])).toEqual(["service"]);
    expect(allowedKindsForModules(["services", "catalog"])).toEqual(["product", "service"]);
    expect(allowedKindsForModules(["broker", "services"])).toEqual(["service"]);
    expect(allowedKindsForModules([])).toEqual([]);
  });

  it("attrsToDetails ignora valores que no son texto", () => {
    expect(attrsToDetails({ Material: "Nogal", n: 3 })).toEqual([{ label: "Material", value: "Nogal" }]);
  });
});
