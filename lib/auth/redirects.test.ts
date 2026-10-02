import { describe, expect, it } from "vitest";
import { originFromHeaders, rootOrigin, safeNext, tenantOrigin } from "./redirects";

const PROD = "ayxco.app";
const LOCAL = "localhost:3100";

describe("safeNext", () => {
  it("acepta rutas relativas", () => {
    expect(safeNext("/admin", PROD)).toBe("/admin");
    expect(safeNext("/login/elegir?x=1", PROD)).toBe("/login/elegir?x=1");
  });

  it("rechaza destinos externos y trucos comunes", () => {
    for (const bad of [
      "//evil.com",
      "///evil.com",
      "/\\evil.com",
      "https://evil.com",
      "https://evil.com/panel",
      "javascript:alert(1)",
      "data:text/html,x",
      "https://ayxco.app.evil.com/panel",
      "https://evilayxco.app",
      "https://user:pass@ayxco.app",
      "http://ayxco.app/panel",
      "https://a.ayxco.app/panel",
      "https://-bad.ayxco.app",
      "https://x.y.ayxco.app",
      "/ok\nSet-Cookie: a=b",
      "",
    ]) {
      expect(safeNext(bad, PROD), bad).toBeNull();
    }
    expect(safeNext(null, PROD)).toBeNull();
    expect(safeNext(undefined, PROD)).toBeNull();
  });

  it("acepta el dominio raíz y subdominios de tenant en producción", () => {
    expect(safeNext("https://ayxco.app/admin", PROD)).toBe("https://ayxco.app/admin");
    expect(safeNext("https://torrezafiro.ayxco.app/panel", PROD)).toBe(
      "https://torrezafiro.ayxco.app/panel",
    );
  });

  it("en local exige http y el mismo puerto", () => {
    expect(safeNext("http://torrezafiro.localhost:3100/panel", LOCAL)).toBe(
      "http://torrezafiro.localhost:3100/panel",
    );
    expect(safeNext("http://torrezafiro.localhost:9999/panel", LOCAL)).toBeNull();
    expect(safeNext("https://torrezafiro.localhost:3100/panel", LOCAL)).toBeNull();
    expect(safeNext("http://evil.com:3100/panel", LOCAL)).toBeNull();
  });
});

describe("orígenes", () => {
  it("construye el origen del tenant y de la raíz", () => {
    expect(tenantOrigin("torrezafiro", PROD)).toBe("https://torrezafiro.ayxco.app");
    expect(tenantOrigin("torrezafiro", LOCAL)).toBe("http://torrezafiro.localhost:3100");
    expect(tenantOrigin("torrezafiro", "torrezafiro.localhost:3100")).toBe(
      "http://torrezafiro.localhost:3100",
    );
    expect(rootOrigin("torrezafiro.ayxco.app")).toBe("https://ayxco.app");
    expect(rootOrigin("torrezafiro.localhost:3100")).toBe("http://localhost:3100");
  });

  it("deriva el origen de la petición", () => {
    expect(originFromHeaders(new Headers({ host: LOCAL }))).toBe("http://localhost:3100");
    expect(originFromHeaders(new Headers({ host: PROD, "x-forwarded-proto": "https" }))).toBe(
      "https://ayxco.app",
    );
  });
});
