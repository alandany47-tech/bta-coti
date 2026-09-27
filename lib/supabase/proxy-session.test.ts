import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Simula a @supabase/ssr renovando un token vencido: getUser() dispara setAll con cookies nuevas.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        options.cookies.setAll([{ name: "sb-access", value: "rotado", options: { path: "/" } }]);
        return { data: { user: null }, error: null };
      },
    },
  }),
}));

const { refreshSession } = await import("./proxy-session");

describe("refreshSession", () => {
  it("devuelve la respuesta que recibió las cookies renovadas", async () => {
    const request = new NextRequest("https://ayx.solutions/login", { headers: { host: "ayx.solutions" } });
    const response = await refreshSession(request);
    expect(response.cookies.get("sb-access")?.value).toBe("rotado");
  });

  it("conserva las cookies renovadas en un rewrite", async () => {
    const request = new NextRequest("https://demo.ayx.solutions/panel", { headers: { host: "demo.ayx.solutions" } });
    const target = new URL("https://demo.ayx.solutions/demo/panel");
    const response = await refreshSession(request, () => NextResponse.rewrite(target, { request }));
    expect(response.cookies.get("sb-access")?.value).toBe("rotado");
    expect(response.headers.get("x-middleware-rewrite")).toBe(target.toString());
    // El request reescrito también lleva la cookie nueva para el Server Component.
    expect(request.cookies.get("sb-access")?.value).toBe("rotado");
  });
});
