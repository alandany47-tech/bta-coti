import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareForPdf } from "./pdf-images";
import type { Property } from "./types";

const tenant = "11111111-1111-1111-1111-111111111111";
const own = (name: string) => `https://media.ayx.solutions/t/${tenant}/_/${name}`;
const property = (images: string[], plan: string | null = null) => ({ images, floor_plan_url: plan }) as unknown as Property;

afterEach(() => vi.unstubAllGlobals());

describe("prepareForPdf", () => {
  it("convierte WebP propio a JPEG data URI y deja pasar URLs legadas", async () => {
    const webp = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#b4532a" } }).webp().toBuffer();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(webp), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await prepareForPdf(property([own("a-full.webp"), "https://picsum.photos/1.jpg"]), tenant);
    expect(result.images[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.images[1]).toBe("https://picsum.photos/1.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no descarga URLs de otra carpeta ni de otro host", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const other = "https://media.ayx.solutions/t/22222222-2222-2222-2222-222222222222/_/a-full.webp";
    const result = await prepareForPdf(property([other, "https://evil.example/t/x.webp"]), tenant);
    expect(result.images).toEqual([other, "https://evil.example/t/x.webp"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omite planos en PDF y descarta imágenes que fallan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const result = await prepareForPdf(property([own("b-full.webp")], own("plan-full.pdf")), tenant);
    expect(result.floor_plan_url).toBeNull();
    expect(result.images).toEqual([]);
  });
});
