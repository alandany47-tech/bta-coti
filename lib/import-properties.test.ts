import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { cellText, readWorkbookRows, rowsToImport } from "./import-properties";

describe("import de propiedades", () => {
  it("mapea encabezados sin acentos ni orden fijo y calcula el total", () => {
    const rows = rowsToImport([
      ["Precio de Lista", "Unidad", "Título", "M2 Interior", "M2 Exterior", "Estacionamientos"],
      ["$1,500,000", "A-101", "Depto Sur", 60, 20, 2],
    ]);
    expect(rows).toEqual([
      { unit_number: "A-101", title: "Depto Sur", m2_interior: 60, m2_exterior: 20, m2_total: 80, parking_spaces: 2, list_price: 1500000 },
    ]);
  });

  it("resuelve fórmulas, texto enriquecido y enlaces", () => {
    expect(cellText({ formula: "A1*2", result: 42 })).toBe("42");
    expect(cellText({ richText: [{ text: "Depto " }, { text: "A" }] })).toBe("Depto A");
    expect(cellText({ text: "x", hyperlink: "https://a.b" })).toBe("x");
    expect(cellText(null)).toBe("");
  });

  it("lee un .xlsx real con ExcelJS", async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Cartera");
    sheet.addRow(["Unidad", "Titulo", "M2 Total", "Precio"]);
    sheet.addRow(["B-2", "Casa", 120, 2500000]);
    sheet.addRow([]);
    sheet.addRow(["B-3", "Casa 2", 100, { formula: "A1", result: 1800000 }]);
    const buffer = await workbook.xlsx.writeBuffer();
    const rows = await readWorkbookRows(buffer as ArrayBuffer);
    expect(rows.map((r) => [r.unit_number, r.m2_total, r.list_price])).toEqual([
      ["B-2", 120, 2500000],
      ["B-3", 100, 1800000],
    ]);
  });
});
