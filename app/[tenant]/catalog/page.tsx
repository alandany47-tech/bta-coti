import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";
import { ExcelDropzone } from "@/components/catalog/excel-dropzone";

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Importar cartera
        </h1>
        <p className="text-sm text-muted">
          Sube un Excel (.xlsx) con tu cartera de propiedades. Las unidades
          existentes se actualizan; las nuevas se agregan. Luego ve a{" "}
          <span className="text-foreground">Propiedades</span> para cargar
          fotos y plano de cada una.
        </p>
      </div>

      <ExcelDropzone tenantSlug={slug} />
    </div>
  );
}
