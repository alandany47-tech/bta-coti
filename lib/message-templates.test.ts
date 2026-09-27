import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, MODULE_VARIABLES, renderMessage, validateTemplateBody } from "./message-templates";

describe("renderMessage", () => {
  it("reemplaza variables conocidas y deja las desconocidas tal cual", () => {
    expect(renderMessage("Hola {cliente}, tu total es {total}. Saludos {vendedor}.", { cliente: "Ana", total: "$100" })).toBe(
      "Hola Ana, tu total es $100. Saludos {vendedor}.",
    );
  });

  it("no falla con llaves sueltas o vacías", () => {
    expect(renderMessage("{} { } {cliente}", { cliente: "Ana" })).toBe("{} { } Ana");
  });

  it("las plantillas por defecto solo usan variables documentadas para su módulo", () => {
    for (const [module, template] of Object.entries(DEFAULT_TEMPLATES) as [keyof typeof DEFAULT_TEMPLATES, string][]) {
      const used = [...template.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]);
      const allowed = new Set(MODULE_VARIABLES[module].map((v) => v.key));
      for (const key of used) expect(allowed.has(key)).toBe(true);
    }
  });
});

describe("validateTemplateBody", () => {
  it("acepta un mensaje normal", () => {
    expect(validateTemplateBody("Hola {cliente}")).toEqual({ ok: true, value: "Hola {cliente}" });
  });

  it("rechaza vacío, HTML y más de 1000 caracteres", () => {
    expect(validateTemplateBody("   ").ok).toBe(false);
    expect(validateTemplateBody("<b>hola</b>").ok).toBe(false);
    expect(validateTemplateBody("a".repeat(1001)).ok).toBe(false);
    expect(validateTemplateBody(42).ok).toBe(false);
  });
});
