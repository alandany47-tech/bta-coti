import { describe, expect, it } from "vitest";
import { cookieDomainFor } from "./cookie-domain";

describe("cookieDomainFor", () => {
  it("comparte la cookie entre la raíz y los subdominios", () => {
    expect(cookieDomainFor("localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("torrezafiro.localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("ayxco.app")).toBe(".ayxco.app");
    expect(cookieDomainFor("torrezafiro.ayxco.app")).toBe(".ayxco.app");
  });

  it("deja host-only cualquier otro dominio", () => {
    expect(cookieDomainFor("mi-app-git-x.vercel.app")).toBeUndefined();
    expect(cookieDomainFor("evilayxco.app")).toBeUndefined();
    expect(cookieDomainFor(null)).toBeUndefined();
  });
});
