import { describe, expect, it } from "vitest";
import { calculatePricing } from "./pricing";
import { buildQuoteSnapshot, parseQuoteSnapshot } from "./quote-snapshot";
import { buildWhatsAppUrl } from "./whatsapp";
import { DEFAULT_TEMPLATES, renderMessage } from "./message-templates";
import type { Property } from "./types";

const property: Property = {
  id: "p1", tenant_id: "t1", title: "Depto", unit_number: "A1", m2_interior: 60, m2_exterior: 20, m2_total: 80,
  parking_spaces: 2, list_price: 1000000, images: Array.from({ length: 12 }, (_, i) => `https://cdn/${i}.webp`),
  floor_plan_url: null, status: "available", created_at: "x", updated_at: "x",
};
const breakdown = calculatePricing({ listPrice: 1000000, discountPct: 10, downPaymentPct: 20, installmentsCount: 12, finalPaymentPct: 0 });

describe("snapshot de cotización", () => {
  const snapshot = buildQuoteSnapshot({
    quoteId: "q1", tenant: { name: "Negocio", logo_url: null, brand_color: "#b4532a" }, advisorName: null,
    clientName: "Ana", clientPhone: "55", property, breakdown, installmentsCount: 12, notes: null, createdAt: "2026-01-01T00:00:00Z",
  });

  it("congela hasta 9 imágenes y los montos calculados", () => {
    expect(snapshot.property?.images).toHaveLength(9);
    expect(snapshot.breakdown.effectivePrice).toBe(900000);
  });

  it("acepta una cotización sin propiedad (legado sin ítem)", () => {
    const withoutProperty = buildQuoteSnapshot({
      quoteId: "q2", tenant: { name: "Negocio", logo_url: null, brand_color: "#000000" }, advisorName: null,
      clientName: "Ana", clientPhone: "55", property: null, breakdown, installmentsCount: 12, notes: null, createdAt: "2026-01-01T00:00:00Z",
    });
    expect(withoutProperty.property).toBeNull();
    expect(parseQuoteSnapshot(JSON.parse(JSON.stringify(withoutProperty)))?.property).toBeNull();
  });

  it("sobrevive un ida y vuelta por JSON y rechaza formas inválidas", () => {
    expect(parseQuoteSnapshot(JSON.parse(JSON.stringify(snapshot)))?.clientName).toBe("Ana");
    expect(parseQuoteSnapshot({ version: 1 })).toBeNull();
    expect(parseQuoteSnapshot(null)).toBeNull();
  });

  it("el mensaje de WhatsApp lleva el enlace de la cotización", () => {
    const message = renderMessage(DEFAULT_TEMPLATES.broker, {
      cliente: "Ana", negocio: "Negocio", propiedad: "Depto", unidad: "A1", plazo: "12",
      total: "$900,000.00", enganche: "$180,000.00", mensualidad: "$60,000.00",
      link: "https://slug.ayx.solutions/q/abc",
    });
    expect(message).toContain("https://slug.ayx.solutions/q/abc");
    expect(buildWhatsAppUrl("55 1234 5678", message)).toContain("https://wa.me/5512345678?text=");
  });
});
