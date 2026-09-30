import { describe, expect, it } from "vitest";
import { validatePlanInput } from "@/lib/plans-shared";

const BASE = { code: "demo", name: "Demo", price_month: 100, price_year: 1000, modules: ["services"], public: true, sort: 5 };

describe("validatePlanInput", () => {
  it("acepta un plan válido y normaliza límites vacíos a null", () => {
    const result = validatePlanInput({ ...BASE, limits: { items: "50", properties: "" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limits.items).toBe(50);
      expect(result.value.limits.properties).toBeNull();
      expect(result.value.modules).toEqual(["services"]);
    }
  });

  it("rechaza un código con mayúsculas o símbolos", () => {
    expect(validatePlanInput({ ...BASE, code: "Demo-1" }).ok).toBe(false);
  });

  it("rechaza un nombre muy corto", () => {
    expect(validatePlanInput({ ...BASE, name: "D" }).ok).toBe(false);
  });

  it("rechaza un módulo desconocido", () => {
    expect(validatePlanInput({ ...BASE, modules: ["services", "no_existe"] }).ok).toBe(false);
  });

  it("rechaza un límite negativo", () => {
    const result = validatePlanInput({ ...BASE, limits: { items: "-5" } });
    expect(result.ok).toBe(false);
  });

  it("rechaza precios negativos", () => {
    expect(validatePlanInput({ ...BASE, price_month: -1 }).ok).toBe(false);
  });
});
