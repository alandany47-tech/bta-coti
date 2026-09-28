import { afterEach, describe, expect, it, vi } from "vitest";
import { pingHeartbeat } from "@/lib/heartbeat";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pingHeartbeat", () => {
  it("no hace nada sin URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat(undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hace GET a la URL configurada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat("https://betterstack.example/heartbeat/abc");
    expect(fetchMock).toHaveBeenCalledWith("https://betterstack.example/heartbeat/abc", { method: "GET" });
  });

  it("no revienta si el fetch falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    await expect(pingHeartbeat("https://betterstack.example/heartbeat/abc")).resolves.toBeUndefined();
  });

  it("no revienta si la respuesta no es OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(pingHeartbeat("https://betterstack.example/heartbeat/abc")).resolves.toBeUndefined();
  });
});
