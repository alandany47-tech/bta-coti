import { describe, expect, it } from "vitest";
import { validateNewClient } from "./admin-new-client";

const base = { name: "Torre Zafiro", slug: "Torre Zafiro", ownerEmail: "Dueño@X.com", plan: "broker" };

describe("validateNewClient", () => {
  it("aplica valores por defecto y normaliza", () => {
    const r = validateNewClient(base);
    expect(r).toMatchObject({ ok: true, value: { slug: "torre-zafiro", status: "trialing", trialDays: 7, billingMode: "stripe" } });
  });

  it("acepta alta activa con cobro manual y sin días de prueba", () => {
    const r = validateNewClient({ ...base, status: "active", billingMode: "manual", trialDays: "" });
    expect(r).toMatchObject({ ok: true, value: { status: "active", trialDays: 0, billingMode: "manual" } });
  });

  it("rechaza plan trial, estado suspendido, correo y días fuera de rango", () => {
    expect(validateNewClient({ ...base, plan: "trial" }).ok).toBe(false);
    expect(validateNewClient({ ...base, status: "suspended" }).ok).toBe(false);
    expect(validateNewClient({ ...base, ownerEmail: "sin-arroba" }).ok).toBe(false);
    expect(validateNewClient({ ...base, trialDays: 0 }).ok).toBe(false);
    expect(validateNewClient({ ...base, trialDays: 91 }).ok).toBe(false);
  });
});
