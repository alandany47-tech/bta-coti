import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteObjects, headObject, presignPut, r2Configured } from "./r2";

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = "acct123";
  process.env.R2_ACCESS_KEY_ID = "AKIATEST";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET = "media-test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) delete process.env[key];
});

describe("r2", () => {
  it("detecta si está configurado", () => {
    expect(r2Configured()).toBe(true);
    delete process.env.R2_BUCKET;
    expect(r2Configured()).toBe(false);
  });

  it("prefirma un PUT de 5 minutos hacia el bucket", async () => {
    const url = new URL(await presignPut("t/abc/_/x-full.webp", "image/webp", 1234));
    expect(url.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/media-test/t/abc/_/x-full.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toContain("AKIATEST/");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  });

  it("HEAD devuelve el tamaño real y null si no existe", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "4321", "content-type": "image/webp" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await headObject("a")).toEqual({ bytes: 4321, contentType: "image/webp" });
    expect(await headObject("b")).toBeNull();
    expect(fetchMock.mock.calls[0][0].method ?? fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
  });

  it("borra las llaves indicadas y omite las nulas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteObjects(["a", null, "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
