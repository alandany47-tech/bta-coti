"use client";

import { useSyncExternalStore } from "react";
import { clampQty, MAX_CART_LINES, type CartLine } from "@/lib/catalog";

/**
 * "Mi cotización" del visitante de una vitrina (T28): una lista por negocio, guardada en el
 * navegador (`localStorage`). No toca la base de datos: sale solo como mensaje de WhatsApp.
 */
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();
/** Negocios cuyo almacenamiento falló (modo privado, cuota): la lista vive solo en memoria. */
const memoryOnly = new Set<string>();

const storageKey = (slug: string) => `ayxco:cart:${slug}`;

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const lines = data
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof l.id === "string" &&
          typeof l.title === "string" &&
          typeof l.price === "number" &&
          Number.isFinite(l.price) &&
          typeof l.qty === "number",
      )
      .slice(0, MAX_CART_LINES)
      .map((l) => ({ id: l.id, title: l.title, price: l.price, unit: l.unit ?? null, qty: clampQty(l.qty) }));
    return lines.length ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function read(slug: string): CartLine[] {
  if (memoryOnly.has(slug)) return cache.get(slug)?.lines ?? EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(slug));
  } catch {
    memoryOnly.add(slug);
    return cache.get(slug)?.lines ?? EMPTY;
  }
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.lines;
  const lines = parse(raw);
  cache.set(slug, { raw, lines });
  return lines;
}

function write(slug: string, lines: CartLine[]) {
  const next = lines.length ? lines : EMPTY;
  const raw = next.length ? JSON.stringify(next) : null;
  try {
    if (raw) window.localStorage.setItem(storageKey(slug), raw);
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    memoryOnly.add(slug);
  }
  cache.set(slug, { raw, lines: next });
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Otra pestaña del mismo negocio modificó la lista.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useCart(slug: string): CartLine[] {
  return useSyncExternalStore(
    subscribe,
    () => read(slug),
    () => EMPTY,
  );
}

type NewLine = Pick<CartLine, "id" | "title" | "price" | "unit">;

export function addToCart(slug: string, item: NewLine) {
  const lines = read(slug);
  const existing = lines.find((l) => l.id === item.id);
  if (existing) {
    write(slug, lines.map((l) => (l.id === item.id ? { ...l, qty: clampQty(l.qty + 1) } : l)));
    return;
  }
  if (lines.length >= MAX_CART_LINES) return;
  write(slug, [...lines, { ...item, qty: 1 }]);
}

export function setCartQty(slug: string, id: string, qty: number) {
  const lines = read(slug);
  if (qty < 1) {
    write(slug, lines.filter((l) => l.id !== id));
    return;
  }
  write(slug, lines.map((l) => (l.id === id ? { ...l, qty: clampQty(qty) } : l)));
}

export function clearCart(slug: string) {
  write(slug, []);
}
