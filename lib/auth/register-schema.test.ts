import { describe, expect, it } from "vitest";
import { normalizeSlugInput, parsePendingTenant, validateRegistration } from "./register-schema";

const base = {
  business: "Panadería Lupita",
  giro: "servicios",
  slug: "panaderia-lupita",
  fullName: "Lupita Pérez",
  email: "Lupita@Correo.com ",
  password: "12345678",
};

describe("validateRegistration", () => {
  it("normaliza y mapea el giro al plan", () => {
    const r = validateRegistration(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("lupita@correo.com");
      expect(r.value.plan_code).toBe("esencial");
    }
  });

  it("mapea catálogo y broker", () => {
    const c = validateRegistration({ ...base, giro: "catalogo" });
    const b = validateRegistration({ ...base, giro: "broker" });
    expect(c.ok && c.value.plan_code).toBe("catalogo");
    expect(b.ok && b.value.plan_code).toBe("broker");
  });

  it("rechaza giro desconocido, slug inválido, correo y contraseña cortos", () => {
    const r = validateRegistration({ ...base, giro: "broker_pro", slug: "-x", email: "a@b", password: "123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "giro", "password", "slug"]);
  });
});

describe("normalizeSlugInput", () => {
  it("quita acentos, espacios y símbolos", () => {
    expect(normalizeSlugInput("  Panadería  Lupita! ")).toBe("panaderia-lupita");
  });
});

describe("parsePendingTenant", () => {
  it("acepta datos válidos", () => {
    expect(parsePendingTenant({ name: "Lupita", slug: "lupita", plan_code: "broker" })).toEqual({
      name: "Lupita",
      slug: "lupita",
      plan_code: "broker",
    });
  });

  it("rechaza planes fuera de la lista, slugs inválidos y tipos raros", () => {
    expect(parsePendingTenant({ name: "X1", slug: "lupita", plan_code: "broker_pro" })).toBeNull();
    expect(parsePendingTenant({ name: "X1", slug: "Lu pita", plan_code: "broker" })).toBeNull();
    expect(parsePendingTenant({ name: 5, slug: "lupita", plan_code: "broker" })).toBeNull();
    expect(parsePendingTenant(null)).toBeNull();
  });
});
