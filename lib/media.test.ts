import { describe, expect, it } from "vitest";
import { mediaUrl, thumbUrl, validateSignRequest } from "./media";

const item = "3f0c6a1e-9b1d-4c3a-8f2e-0a1b2c3d4e5f";
const base = { tenant: "lupita", itemId: item, kind: "image", contentType: "image/webp", bytes: 300_000, thumbBytes: 40_000, width: 2000, height: 1333 };

describe("validateSignRequest", () => {
  it("acepta una imagen WebP con miniatura", () => {
    expect(validateSignRequest(base)).toMatchObject({ ok: true, value: { kind: "image", bytes: 300_000, thumbBytes: 40_000 } });
  });

  it("acepta un plano PDF de 10 MB y un logo sin propiedad", () => {
    expect(validateSignRequest({ ...base, kind: "plan", contentType: "application/pdf", bytes: 10 * 1024 * 1024, thumbBytes: 0 }).ok).toBe(true);
    expect(validateSignRequest({ ...base, kind: "logo", itemId: null, thumbBytes: 0 }).ok).toBe(true);
  });

  it("rechaza formato, tamaño, miniatura y propiedad inválidos", () => {
    expect(validateSignRequest({ ...base, contentType: "image/jpeg" }).ok).toBe(false);
    expect(validateSignRequest({ ...base, bytes: 3 * 1024 * 1024 }).ok).toBe(false);
    expect(validateSignRequest({ ...base, bytes: 0 }).ok).toBe(false);
    expect(validateSignRequest({ ...base, thumbBytes: 300 * 1024 }).ok).toBe(false);
    expect(validateSignRequest({ ...base, kind: "plan", contentType: "application/pdf", thumbBytes: 10 }).ok).toBe(false);
    expect(validateSignRequest({ ...base, contentType: "application/pdf" }).ok).toBe(false);
    expect(validateSignRequest({ ...base, kind: "plan", contentType: "image/webp", bytes: 3 * 1024 * 1024 }).ok).toBe(false);
    expect(validateSignRequest({ ...base, itemId: "no-uuid" }).ok).toBe(false);
    expect(validateSignRequest({ ...base, kind: "logo", itemId: item }).ok).toBe(false);
    expect(validateSignRequest({ ...base, kind: "video" }).ok).toBe(false);
    expect(validateSignRequest(null).ok).toBe(false);
  });
});

describe("thumbUrl", () => {
  it("cambia -full por -thumb solo en medios de R2", () => {
    expect(thumbUrl("https://m.x/t/a/b/c-full.webp")).toBe("https://m.x/t/a/b/c-thumb.webp");
    expect(thumbUrl("https://picsum.photos/1.jpg")).toBe("https://picsum.photos/1.jpg");
  });
});

describe("mediaUrl", () => {
  it("compone la URL del CDN", () => {
    expect(mediaUrl("t/a/b/c-full.webp")).toMatch(/^https:\/\/media\..+\/t\/a\/b\/c-full\.webp$/);
  });
});
