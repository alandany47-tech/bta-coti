import { BRAND } from "@/lib/brand";

export default function MarketingHome() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {BRAND.name}
        </h1>
        <p className="mt-3 text-foreground-muted">
          Cada PyME accede a su propio espacio en{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-sm">
            tu-negocio.{BRAND.domain}
          </code>
          . En desarrollo local usa{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-sm">
            tu-negocio.localhost:3000
          </code>
          .
        </p>
      </div>
    </div>
  );
}
