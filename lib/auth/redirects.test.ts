import { describe, expect, it } from "vitest";
import { originFromHeaders, rootOrigin, safeNext, tenantOrigin } from "./redirects";

const PROD = "btacotiza.com";
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
      "https://btacotiza.com.evil.com/panel",
      "https://evilbtacotiza.com",
      "https://user:pass@btacotiza.com",
      "http://btacotiza.com/panel",
      "https://a.btacotiza.com/panel",
      "https://-bad.btacotiza.com",
      "https://x.y.btacotiza.com",
      "/ok\nSet-Cookie: a=b",
      "",
    ]) {
      expect(safeNext(bad, PROD), bad).toBeNull();
    }
    expect(safeNext(null, PROD)).toBeNull();
    expect(safeNext(undefined, PROD)).toBeNull();
  });

  it("acepta el dominio raíz y subdominios de tenant en producción", () => {
    expect(safeNext("https://btacotiza.com/admin", PROD)).toBe("https://btacotiza.com/admin");
    expect(safeNext("https://torrezafiro.btacotiza.com/panel", PROD)).toBe(
      "https://torrezafiro.btacotiza.com/panel",
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
    expect(tenantOrigin("torrezafiro", PROD)).toBe("https://torrezafiro.btacotiza.com");
    expect(tenantOrigin("torrezafiro", LOCAL)).toBe("http://torrezafiro.localhost:3100");
    expect(tenantOrigin("torrezafiro", "torrezafiro.localhost:3100")).toBe(
      "http://torrezafiro.localhost:3100",
    );
    expect(rootOrigin("torrezafiro.btacotiza.com")).toBe("https://btacotiza.com");
    expect(rootOrigin("torrezafiro.localhost:3100")).toBe("http://localhost:3100");
  });

  it("deriva el origen de la petición", () => {
    expect(originFromHeaders(new Headers({ host: LOCAL }))).toBe("http://localhost:3100");
    expect(originFromHeaders(new Headers({ host: PROD, "x-forwarded-proto": "https" }))).toBe(
      "https://btacotiza.com",
    );
  });
});
