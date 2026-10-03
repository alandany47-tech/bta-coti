import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, whatsappDigits } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("agrega la lada de México a un teléfono de 10 dígitos, con o sin formato", () => {
    expect(buildWhatsAppUrl("5512345678", "hola")).toBe("https://wa.me/525512345678?text=hola");
    expect(buildWhatsAppUrl("(55) 1234-5678", "hola")).toBe("https://wa.me/525512345678?text=hola");
    expect(buildWhatsAppUrl("55 1234 5678", "a b")).toBe("https://wa.me/525512345678?text=a%20b");
  });

  it("respeta un número que ya trae código de país", () => {
    expect(whatsappDigits("+52 1 55 1234 5678")).toBe("5215512345678");
    expect(whatsappDigits("+1 (415) 555-0100")).toBe("14155550100");
  });

  it("sin teléfono (demo) deja elegir el contacto en WhatsApp; uno corto no se inventa", () => {
    expect(buildWhatsAppUrl("", "x")).toBe("https://wa.me/?text=x");
    expect(whatsappDigits("12345")).toBe("12345");
  });
});
