import { describe, expect, it } from "vitest";
import { hashInvitationToken, isTeamRole, newInvitationToken, normalizeInviteEmail, teamErrorResponse } from "./team";

describe("equipo", () => {
  it("el token es largo, único y solo su hash viaja a la base", () => {
    const a = newInvitationToken();
    const b = newInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(a.token)).toBe(a.hash);
    expect(a.hash).not.toContain(a.token);
  });

  it("normaliza y valida el correo", () => {
    expect(normalizeInviteEmail("  Ana@Correo.COM ")).toBe("ana@correo.com");
    expect(normalizeInviteEmail("sin-arroba")).toBeNull();
    expect(normalizeInviteEmail("a@b")).toBeNull();
    expect(normalizeInviteEmail(42)).toBeNull();
    expect(normalizeInviteEmail(`${"a".repeat(250)}@x.com`)).toBeNull();
  });

  it("solo se asignan editor y vendedor (viewer)", () => {
    expect(isTeamRole("editor")).toBe(true);
    expect(isTeamRole("viewer")).toBe(true);
    expect(isTeamRole("owner")).toBe(false);
  });

  it("mapea los errores de la base a mensajes", () => {
    expect(teamErrorResponse("user_quota_exceeded").status).toBe(409);
    expect(teamErrorResponse("ERROR: already_member").status).toBe(409);
    expect(teamErrorResponse("demo_readonly").status).toBe(403);
    expect(teamErrorResponse("algo raro").status).toBe(500);
  });
});
