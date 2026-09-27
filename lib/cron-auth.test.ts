import { afterEach, describe, expect, it } from "vitest";
import { isCronRequest } from "./cron-auth";

const request = (authorization?: string) =>
  new Request("https://ayx.solutions/api/cron/daily", { headers: authorization ? { authorization } : {} });

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("isCronRequest", () => {
  it("acepta solo el Bearer exacto", () => {
    process.env.CRON_SECRET = "s3cr3t-largo";
    expect(isCronRequest(request("Bearer s3cr3t-largo"))).toBe(true);
    expect(isCronRequest(request("Bearer otro"))).toBe(false);
    expect(isCronRequest(request("s3cr3t-largo"))).toBe(false);
    expect(isCronRequest(request())).toBe(false);
  });

  it("sin CRON_SECRET configurado nada pasa", () => {
    expect(isCronRequest(request("Bearer "))).toBe(false);
    expect(isCronRequest(request("Bearer undefined"))).toBe(false);
  });
});
