import { describe, expect, it } from "vitest";
import {
  buildCartMessage,
  cartCount,
  cartTotal,
  clampQty,
  filterItems,
  listCategories,
  normalizeWhatsapp,
  whatsappHref,
  type CartLine,
  type CatalogItem,
} from "@/lib/catalog";

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: "1",
  title: "Sofá modular",
  description: null,
  category: "Salas",
  price: 100,
  unit: "pieza",
  images: [],
  sku: null,
  ...over,
});

describe("listCategories", () => {
  it("cuenta por categoría en orden de aparición y agrupa lo que no tiene en General", () => {
    const result = listCategories([item({}), item({ id: "2", category: null }), item({ id: "3" })]);
    expect(result).toEqual([
      { name: "Salas", count: 2 },
      { name: "General", count: 1 },
    ]);
  });
});

describe("filterItems", () => {
  const items = [
    item({ id: "1", title: "Cama King Fresno", category: "Recámaras", sku: "REC-001" }),
    item({ id: "2", title: "Buró flotante", category: "Recámaras", description: "Cierre suave" }),
    item({ id: "3", title: "Mesa de centro", category: "Salas" }),
  ];

  it("filtra por categoría", () => {
    expect(filterItems(items, { category: "Salas" }).map((i) => i.id)).toEqual(["3"]);
  });

  it("busca sin acentos, en título, descripción y SKU", () => {
    expect(filterItems(items, { query: "recamaras" }).map((i) => i.id)).toEqual(["1", "2"]);
    expect(filterItems(items, { query: "cierre" }).map((i) => i.id)).toEqual(["2"]);
    expect(filterItems(items, { query: "rec-001" }).map((i) => i.id)).toEqual(["1"]);
  });

  it("exige todas las palabras", () => {
    expect(filterItems(items, { query: "cama mesa" })).toEqual([]);
  });
});

describe("carrito", () => {
  const lines: CartLine[] = [
    { id: "a", title: "Silla Aspen", price: 1690, unit: "pieza", qty: 4 },
    { id: "b", title: "Entrega", price: 890, unit: "servicio", qty: 1 },
  ];

  it("suma total y piezas", () => {
    expect(cartTotal(lines)).toBe(7650);
    expect(cartCount(lines)).toBe(5);
  });

  it("limita la cantidad de 1 a 99", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(250)).toBe(99);
    expect(clampQty(2.9)).toBe(2);
    expect(clampQty(Number.NaN)).toBe(1);
  });

  it("arma el mensaje con renglones, total y catálogo", () => {
    const text = buildCartMessage({ businessName: "Muebles Nogal", lines, catalogUrl: "https://x.ayxco.app" });
    expect(text).toContain("- 4 × Silla Aspen: $6,760.00");
    expect(text).toContain("Total estimado: $7,650.00");
    expect(text).toContain("https://x.ayxco.app");
    expect(text).not.toMatch(/!/);
  });
});

describe("WhatsApp", () => {
  it("con número escribe directo; sin número deja elegir contacto", () => {
    expect(whatsappHref("5215512345678", "hola")).toBe("https://wa.me/5215512345678?text=hola");
    expect(whatsappHref(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });

  it("normaliza números del panel", () => {
    expect(normalizeWhatsapp("55 1234 5678")).toBe("525512345678");
    expect(normalizeWhatsapp("+52 1 55 1234 5678")).toBe("5215512345678");
    expect(normalizeWhatsapp("1234")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
  });
});
