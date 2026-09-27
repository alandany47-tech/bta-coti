import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const revalidateTag = vi.fn();
const listObjects = vi.fn();
const deleteObjects = vi.fn();
let configured = true;

vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({ rpc }) }));
vi.mock("@/lib/r2", () => ({
  r2Configured: () => configured,
  listObjects: (...args: unknown[]) => listObjects(...args),
  deleteObjects: (...args: unknown[]) => deleteObjects(...args),
}));

const { expireTrials, resetMonthlyQuotes, sweepR2Orphans, ORPHAN_MIN_AGE_MS } = await import("./daily-cron");

const NOW = Date.parse("2026-09-27T08:00:00Z");
const old = new Date(NOW - ORPHAN_MIN_AGE_MS - 1000);
const fresh = new Date(NOW - 60_000);

beforeEach(() => {
  rpc.mockReset();
  revalidateTag.mockReset();
  listObjects.mockReset();
  deleteObjects.mockReset().mockResolvedValue(0);
  configured = true;
});

describe("expireTrials", () => {
  it("invalida el caché de cada tenant suspendido", async () => {
    rpc.mockResolvedValue({ data: [{ tenant_id: "1", slug: "uno" }, { tenant_id: "2", slug: "dos" }], error: null });
    expect(await expireTrials()).toEqual({ expired: ["uno", "dos"] });
    expect(rpc).toHaveBeenCalledWith("expire_trials");
    expect(revalidateTag).toHaveBeenCalledWith("tenant:uno", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("tenant:dos", { expire: 0 });
  });

  it("propaga el error de la base", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(expireTrials()).rejects.toThrow("expire_trials: boom");
  });
});

describe("resetMonthlyQuotes", () => {
  it("devuelve cuántos contadores reinició", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    expect(await resetMonthlyQuotes()).toEqual({ reset: 3 });
  });
});

describe("sweepR2Orphans", () => {
  it("sin R2 configurado no hace nada", async () => {
    configured = false;
    expect(await sweepR2Orphans({ now: NOW })).toMatchObject({ skipped: "r2_not_configured", complete: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("borra reservas vencidas y solo los huérfanos con más de 24 h, página por página", async () => {
    rpc.mockImplementation(async (name: string, args: { p_keys?: string[] }) => {
      if (name === "purge_stale_pending_media") return { data: [{ r2_key: "t/a/_/p-full.webp", thumb_key: null }], error: null };
      if (name === "orphan_media_keys") return { data: args.p_keys!.filter((k) => k.includes("huerfana")), error: null };
      throw new Error(name);
    });
    listObjects
      .mockResolvedValueOnce({
        objects: [
          { key: "t/a/_/huerfana-1.webp", lastModified: old, bytes: 1 },
          { key: "t/a/_/usada.webp", lastModified: old, bytes: 1 },
          { key: "t/a/_/huerfana-reciente.webp", lastModified: fresh, bytes: 1 },
        ],
        next: "p2",
      })
      .mockResolvedValueOnce({ objects: [{ key: "t/b/_/huerfana-2.webp", lastModified: old, bytes: 1 }], next: null });

    const result = await sweepR2Orphans({ now: NOW });

    expect(result).toEqual({ pendingPurged: 1, scanned: 4, deleted: 2, failed: 0, complete: true });
    expect(listObjects).toHaveBeenNthCalledWith(1, "t/", null);
    expect(listObjects).toHaveBeenNthCalledWith(2, "t/", "p2");
    // La reciente (< 24 h) ni siquiera se consulta: puede ser una subida en curso.
    expect(rpc).toHaveBeenCalledWith("orphan_media_keys", { p_keys: ["t/a/_/huerfana-1.webp", "t/a/_/usada.webp"] });
    expect(deleteObjects).toHaveBeenCalledWith(["t/a/_/p-full.webp", null]);
    expect(deleteObjects).toHaveBeenCalledWith(["t/a/_/huerfana-1.webp"]);
    expect(deleteObjects).toHaveBeenCalledWith(["t/b/_/huerfana-2.webp"]);
  });

  it("se detiene al pasar el deadline y lo reporta como incompleto", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const result = await sweepR2Orphans({ now: NOW, deadline: Date.now() - 1 });
    expect(result.complete).toBe(false);
    expect(listObjects).not.toHaveBeenCalled();
  });

  it("si la base falla al clasificar, no borra nada de esa página", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "purge_stale_pending_media" ? { data: [], error: null } : { data: null, error: { message: "timeout" } },
    );
    listObjects.mockResolvedValueOnce({ objects: [{ key: "t/a/_/x.webp", lastModified: old, bytes: 1 }], next: null });
    await expect(sweepR2Orphans({ now: NOW })).rejects.toThrow("orphan_media_keys: timeout");
    expect(deleteObjects).toHaveBeenCalledTimes(1); // solo el lote (vacío) de reservas vencidas
  });
});
