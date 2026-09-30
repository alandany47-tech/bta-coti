import { describe, expect, it } from "vitest";
import { computeMrr, computeTrialConversion } from "./admin-kpis";

describe("computeMrr", () => {
  const plans = [
    { price_month: 500, price_year: 4800, stripe_price_month: "price_a_m", stripe_price_year: "price_a_y" },
    { price_month: 900, price_year: 9600, stripe_price_month: "price_b_m", stripe_price_year: "price_b_y" },
  ];

  it("suma el precio mensual de una suscripción activa mensual", () => {
    expect(computeMrr([{ status: "active", stripe_price_id: "price_a_m" }], plans)).toBe(500);
  });

  it("divide el precio anual entre 12 para una suscripción anual", () => {
    expect(computeMrr([{ status: "active", stripe_price_id: "price_a_y" }], plans)).toBe(400);
  });

  it("mezcla mensual y anual de distintos planes", () => {
    const subs = [
      { status: "active", stripe_price_id: "price_a_m" },
      { status: "active", stripe_price_id: "price_b_y" },
    ];
    expect(computeMrr(subs, plans)).toBe(500 + 800);
  });

  it("ignora suscripciones que no están activas", () => {
    expect(computeMrr([{ status: "past_due", stripe_price_id: "price_a_m" }], plans)).toBe(0);
  });

  it("ignora price ids que no matchean ningún plan", () => {
    expect(computeMrr([{ status: "active", stripe_price_id: "price_desconocido" }], plans)).toBe(0);
  });

  it("sin suscripciones da 0", () => {
    expect(computeMrr([], plans)).toBe(0);
  });
});

describe("computeTrialConversion", () => {
  it("null si no hay pruebas que hayan vencido en la ventana", () => {
    expect(computeTrialConversion([])).toBeNull();
  });

  it("calcula convertidos sobre el total", () => {
    expect(computeTrialConversion([{ status: "active" }, { status: "canceled" }, { status: "active" }])).toEqual({
      converted: 2,
      total: 3,
    });
  });
});
