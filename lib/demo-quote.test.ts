import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, renderMessage } from "@/lib/message-templates";
import { MAX_DEMO_CLIENT_NAME, normalizeDemoClientName, withoutLinkLines } from "@/lib/demo-quote";

describe("normalizeDemoClientName", () => {
  it("recorta y colapsa espacios", () => {
    expect(normalizeDemoClientName("  Laura   Hernández ")).toBe("Laura Hernández");
  });

  it("rechaza vacío, un solo carácter y valores que no son texto", () => {
    expect(normalizeDemoClientName("   ")).toBeNull();
    expect(normalizeDemoClientName("A")).toBeNull();
    expect(normalizeDemoClientName(undefined)).toBeNull();
    expect(normalizeDemoClientName(42)).toBeNull();
  });

  it("limita la longitud", () => {
    expect(normalizeDemoClientName("x".repeat(500))).toHaveLength(MAX_DEMO_CLIENT_NAME);
  });
});

describe("withoutLinkLines", () => {
  it("quita la línea del enlace de la plantilla broker y no deja saltos de más", () => {
    const text = withoutLinkLines(DEFAULT_TEMPLATES.broker);
    expect(text).not.toContain("{link}");
    expect(text).not.toMatch(/\n{3,}/);
    expect(text.endsWith("meses")).toBe(true);
  });

  it("deja intactas las demás variables para que renderMessage las resuelva", () => {
    const rendered = renderMessage(withoutLinkLines(DEFAULT_TEMPLATES.services), {
      cliente: "Ana",
      negocio: "Taller",
      fecha: "3 de octubre",
      total: "$100.00",
    });
    expect(rendered).toContain("Hola Ana");
    expect(rendered).toContain("Total: $100.00");
    expect(rendered).not.toContain("http");
  });
});
