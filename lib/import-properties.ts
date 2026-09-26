import type { PropertyImportRow } from "@/lib/types";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

export function normalizeHeader(header: unknown) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Texto de una celda de ExcelJS: resuelve fórmulas, texto enriquecido, enlaces y fechas. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const cell = value as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if (cell.result !== undefined) return cellText(cell.result);
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("");
    if (cell.text !== undefined) return cellText(cell.text);
    return "";
  }
  return String(value);
}

const toNumber = (value: string) => {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Columnas esperadas (orden libre, sin acentos obligatorios): Unidad, Titulo, M2 Interior,
 * M2 Exterior, M2 Total (opcional, se calcula si falta), Estacionamientos, Precio de Lista.
 * `rows[0]` son los encabezados.
 */
export function rowsToImport(rows: unknown[][]): PropertyImportRow[] {
  const [headers, ...body] = rows;
  if (!headers) return [];
  const columns = headers.map(normalizeHeader);

  return body.map((cells): PropertyImportRow => {
    const row: PropertyImportRow = {
      unit_number: "",
      title: "",
      m2_interior: 0,
      m2_exterior: 0,
      m2_total: 0,
      parking_spaces: 0,
      list_price: 0,
    };

    columns.forEach((column, index) => {
      const text = cellText(cells[index]).trim();
      switch (column) {
        case "unidad":
        case "nounidad":
        case "unitnumber":
          row.unit_number = text;
          break;
        case "titulo":
        case "nombre":
          row.title = text;
          break;
        case "m2interior":
        case "m2interiores":
          row.m2_interior = toNumber(text);
          break;
        case "m2exterior":
        case "m2exteriores":
          row.m2_exterior = toNumber(text);
          break;
        case "m2total":
        case "m2totales":
          row.m2_total = toNumber(text);
          break;
        case "estacionamientos":
        case "cajones":
          row.parking_spaces = Math.floor(toNumber(text));
          break;
        case "preciodelista":
        case "precio":
        case "listprice":
          row.list_price = toNumber(text);
          break;
      }
    });

    if (!row.m2_total) row.m2_total = row.m2_interior + row.m2_exterior;
    return row;
  });
}

/** Lee la primera hoja de un .xlsx en el navegador (ExcelJS se carga solo al importar). */
export async function readWorkbookRows(buffer: ArrayBuffer): Promise<PropertyImportRow[]> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // row.values es 1-indexado: el primer elemento siempre está vacío.
    rows.push((row.values as unknown[]).slice(1));
  });
  return rowsToImport(rows.slice(0, MAX_IMPORT_ROWS + 1));
}
