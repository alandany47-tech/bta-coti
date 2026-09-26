import { describe, expect, it } from "vitest";
import { cookieDomainFor } from "./cookie-domain";

describe("cookieDomainFor", () => {
  it("comparte la cookie entre la raíz y los subdominios", () => {
    expect(cookieDomainFor("localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("torrezafiro.localhost:3100")).toBe("localhost");
    expect(cookieDomainFor("ayx.solutions")).toBe(".ayx.solutions");
    expect(cookieDomainFor("torrezafiro.ayx.solutions")).toBe(".ayx.solutions");
  });

  it("deja host-only cualquier otro dominio", () => {
    expect(cookieDomainFor("mi-app-git-x.vercel.app")).toBeUndefined();
    expect(cookieDomainFor("evilayx.solutions")).toBeUndefined();
    expect(cookieDomainFor(null)).toBeUndefined();
  });
});
