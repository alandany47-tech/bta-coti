import { describe, expect, it } from "vitest";
import { cookieDomainFor } from "./cookie-domain";

describe("cookieDomainFor", () => {
  it("comparte la cookie entre la raíz y los subdominios", () => {
    expect(cookieDomainFor("localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("torrezafiro.localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("btacotiza.com")).toBe(".btacotiza.com");
    expect(cookieDomainFor("torrezafiro.btacotiza.com")).toBe(".btacotiza.com");
  });

  it("deja host-only cualquier otro dominio", () => {
    expect(cookieDomainFor("mi-app-git-x.vercel.app")).toBeUndefined();
    expect(cookieDomainFor("evilbtacotiza.com")).toBeUndefined();
    expect(cookieDomainFor(null)).toBeUndefined();
  });
});
