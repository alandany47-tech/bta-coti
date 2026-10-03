import { describe, expect, it } from "vitest";
import { trialReminderKind } from "./schedule";

const now = new Date("2026-10-10T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe("trialReminderKind", () => {
  it("no avisa si falta mucho", () => expect(trialReminderKind(inHours(24 * 5), now)).toBeNull());
  it("día 5 cuando faltan 3 días o menos", () => {
    expect(trialReminderKind(inHours(72), now)).toBe("trial_day5");
    expect(trialReminderKind(inHours(30), now)).toBe("trial_day5");
  });
  it("día 7 cuando falta 1 día o menos, aunque el día 5 no haya salido", () => {
    expect(trialReminderKind(inHours(24), now)).toBe("trial_day7");
    expect(trialReminderKind(inHours(2), now)).toBe("trial_day7");
  });
  it("nada si ya venció", () => expect(trialReminderKind(inHours(-1), now)).toBeNull());
});
