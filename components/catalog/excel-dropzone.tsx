"use client";

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PropertyImportRow } from "@/lib/types";

function normalizeHeader(header: string) {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Columnas esperadas (orden libre, sin acentos obligatorios):
 * Unidad, Titulo, M2 Interior, M2 Exterior, M2 Total (opcional, se calcula
 * si falta), Estacionamientos, Precio de Lista.
 */
function parseWorkbook(buffer: ArrayBuffer): PropertyImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rawRows.map((raw): PropertyImportRow => {
    const row: PropertyImportRow = {
      unit_number: "",
      title: "",
      m2_interior: 0,
      m2_exterior: 0,
      m2_total: 0,
      parking_spaces: 0,
      list_price: 0,
    };

    for (const [key, value] of Object.entries(raw)) {
      switch (normalizeHeader(key)) {
        case "unidad":
        case "nounidad":
        case "unitnumber":
          row.unit_number = String(value ?? "").trim();
          break;
        case "titulo":
        case "nombre":
          row.title = String(value ?? "").trim();
          break;
        case "m2interior":
        case "m2interiores":
          row.m2_interior = Number(value) || 0;
          break;
        case "m2exterior":
        case "m2exteriores":
          row.m2_exterior = Number(value) || 0;
          break;
        case "m2total":
        case "m2totales":
          row.m2_total = Number(value) || 0;
          break;
        case "estacionamientos":
        case "cajones":
          row.parking_spaces = Math.floor(Number(value)) || 0;
          break;
        case "preciodelista":
        case "precio":
        case "listprice":
          row.list_price = Number(value) || 0;
          break;
      }
    }

    if (!row.m2_total) {
      row.m2_total = row.m2_interior + row.m2_exterior;
    }

    return row;
  });
}

type ImportState =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "uploading"; fileName: string; rows: number }
  | { status: "success"; fileName: string; imported: number }
  | { status: "error"; fileName: string; message: string };

export function ExcelDropzone({ tenantSlug }: { tenantSlug: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<ImportState>({ status: "idle" });

  const handleFile = useCallback(
    async (file: File) => {
      setState({ status: "parsing", fileName: file.name });
      try {
        const buffer = await file.arrayBuffer();
        const rows = parseWorkbook(buffer).filter(
          (row) => row.unit_number && row.title,
        );

        if (rows.length === 0) {
          setState({
            status: "error",
            fileName: file.name,
            message:
              "No se encontraron filas válidas. Verifica las columnas: Unidad, Titulo, M2 Interior, M2 Exterior, Estacionamientos, Precio de Lista.",
          });
          return;
        }

        setState({ status: "uploading", fileName: file.name, rows: rows.length });

        const res = await fetch(`/api/${tenantSlug}/properties/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const data = await res.json();

        if (!res.ok) {
          setState({
            status: "error",
            fileName: file.name,
            message: data.error ?? "Error al importar la cartera.",
          });
          return;
        }

        setState({
          status: "success",
          fileName: file.name,
          imported: data.imported ?? rows.length,
        });
      } catch {
        setState({
          status: "error",
          fileName: file.name,
          message: "No se pudo leer el archivo. ¿Es un .xlsx válido?",
        });
      }
    },
    [tenantSlug],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        isDragging
          ? "border-foreground bg-surface-hover"
          : "border-border-subtle bg-surface",
      )}
    >
      <UploadCloud className="h-8 w-8 text-muted" />
      <div>
        <p className="text-sm text-foreground">
          Arrastra tu archivo .xlsx aquí, o
        </p>
        <label className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-2">
          selecciona un archivo
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Columnas esperadas: Unidad, Titulo, M2 Interior, M2 Exterior, M2 Total
        (opcional), Estacionamientos, Precio de Lista
      </p>

      {state.status !== "idle" && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-background px-3 py-2 text-xs">
          <FileSpreadsheet className="h-4 w-4 text-muted" />
          <span className="text-foreground-muted">{state.fileName}</span>
          {state.status === "parsing" && <span className="text-muted">Leyendo…</span>}
          {state.status === "uploading" && (
            <span className="text-muted">Importando {state.rows} filas…</span>
          )}
          {state.status === "success" && (
            <span className="flex items-center gap-1 text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {state.imported} propiedades importadas
            </span>
          )}
          {state.status === "error" && (
            <span className="flex items-center gap-1 text-danger">
              <XCircle className="h-3.5 w-3.5" />
              {state.message}
            </span>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-1"
        onClick={() => setState({ status: "idle" })}
      >
        Limpiar
      </Button>
    </div>
  );
}
