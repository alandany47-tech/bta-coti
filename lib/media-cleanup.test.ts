import { describe, expect, it } from "vitest";
import { paginateAll } from "@/lib/media-cleanup";

function pagedFetcher(rows: number[]) {
  return async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null });
}

describe("paginateAll", () => {
  it("junta varias páginas completas más una parcial", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const result = await paginateAll(1000, pagedFetcher(rows));
    expect(result).toEqual(rows);
  });

  it("una sola página parcial no pide una siguiente", async () => {
    const calls: number[] = [];
    const fetchPage = async (from: number) => {
      calls.push(from);
      return { data: [1, 2, 3], error: null };
    };
    const result = await paginateAll(1000, fetchPage);
    expect(result).toEqual([1, 2, 3]);
    expect(calls).toEqual([0]);
  });

  it("una página exacta al tamaño del límite sí pide la siguiente (que viene vacía)", async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => i), []];
    let call = 0;
    const fetchPage = async () => ({ data: pages[call++], error: null });
    const result = await paginateAll(1000, fetchPage);
    expect(result).toHaveLength(1000);
    expect(call).toBe(2);
  });

  it("revienta en vez de devolver un resultado parcial si una página falla", async () => {
    let call = 0;
    const fetchPage = async () => {
      call++;
      if (call === 2) return { data: null, error: new Error("boom") };
      return { data: [1, 2, 3], error: null };
    };
    await expect(paginateAll(3, fetchPage)).rejects.toThrow("boom");
  });
});
