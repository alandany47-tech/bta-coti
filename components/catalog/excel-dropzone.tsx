"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS, readWorkbookRows } from "@/lib/import-properties";

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
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
          setState({ status: "error", fileName: file.name, message: "Solo se aceptan archivos .xlsx. Si tienes un .xls, guárdalo como .xlsx desde Excel." });
          return;
        }
        if (file.size > MAX_IMPORT_FILE_BYTES) {
          setState({ status: "error", fileName: file.name, message: "El archivo pesa más de 5 MB." });
          return;
        }
        const parsed = await readWorkbookRows(await file.arrayBuffer());
        if (parsed.truncated) {
          setState({ status: "error", fileName: file.name, message: `El archivo trae más de ${MAX_IMPORT_ROWS} filas. Divídelo en partes más chicas.` });
          return;
        }
        const rows = parsed.rows.filter((row) => row.unit_number && row.title);

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
            accept=".xlsx"
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
