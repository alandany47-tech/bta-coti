import { describe, expect, it } from "vitest";
import { importRowToItem, itemToProperty } from "./items";

const base = {
  id: "i1",
  tenant_id: "t1",
  title: "Depto",
  sku: "A1",
  price: "1500000.00",
  status: "available",
  images: ["https://cdn.example/a.webp"],
  floor_plan_url: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

describe("items ↔ property", () => {
  it("convierte una fila items a Property", () => {
    const property = itemToProperty({ ...base, attrs: { unit_number: "A-1", m2_interior: 60, m2_exterior: 20, m2_total: 80, parking: 2 } });
    expect(property).toMatchObject({
      unit_number: "A-1", list_price: 1500000, m2_total: 80, parking_spaces: 2, images: ["https://cdn.example/a.webp"],
    });
  });

  it("tolera attrs vacíos usando el sku como unidad", () => {
    const property = itemToProperty({ ...base, attrs: null });
    expect(property).toMatchObject({ unit_number: "A1", m2_total: 0, parking_spaces: 0 });
  });

  it("arma la fila items del import con sku = unidad y total calculado", () => {
    const row = importRowToItem("t1", {
      unit_number: " B-2 ", title: " Casa ", m2_interior: 90, m2_exterior: 30, m2_total: 0, parking_spaces: 2.7, list_price: -5,
    });
    expect(row).toMatchObject({
      tenant_id: "t1", kind: "property", sku: "B-2", title: "Casa", price: 0,
      attrs: { unit_number: "B-2", m2_total: 120, parking: 2 },
    });
  });
});
