import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteObjects, headObject, listObjects, presignPut, r2Configured } from "./r2";

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

  it("cuenta las llaves cuyo DELETE falló (404 no cuenta)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await deleteObjects(["a", "b", "c"])).toBe(1);
  });

  it("lista una página de ListObjectsV2 con su token de continuación", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult><Name>media-test</Name><Prefix>t/</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys>
<IsTruncated>true</IsTruncated><NextContinuationToken>abc&amp;123</NextContinuationToken>
<Contents><Key>t/uno/_/a-full.webp</Key><LastModified>2026-09-01T10:00:00.000Z</LastModified><Size>120</Size></Contents>
<Contents><Key>t/dos/_/b&amp;c-thumb.webp</Key><LastModified>2026-09-02T10:00:00.000Z</LastModified><Size>30</Size></Contents>
</ListBucketResult>`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(xml, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await listObjects("t/", "prev-token");
    expect(page.next).toBe("abc&123");
    expect(page.objects).toEqual([
      { key: "t/uno/_/a-full.webp", lastModified: new Date("2026-09-01T10:00:00.000Z"), bytes: 120 },
      { key: "t/dos/_/b&c-thumb.webp", lastModified: new Date("2026-09-02T10:00:00.000Z"), bytes: 30 },
    ]);
    const requested = new URL((fetchMock.mock.calls[0][0] as Request).url);
    expect(requested.pathname).toBe("/media-test");
    expect(requested.searchParams.get("list-type")).toBe("2");
    expect(requested.searchParams.get("prefix")).toBe("t/");
    expect(requested.searchParams.get("continuation-token")).toBe("prev-token");
  });

  it("la última página no trae token", async () => {
    const xml = "<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(xml, { status: 200 })));
    expect(await listObjects("t/")).toEqual({ objects: [], next: null });
  });
});
