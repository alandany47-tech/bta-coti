import Image from "next/image";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
} & (
  | { status: "available"; screenshotSrc: string; screenshotAlt: string; planCode: string; priceMonth: number }
  | { status: "soon" }
);

export function ModuleLanding(props: Props) {
  const supportDigits = SUPPORT_WHATSAPP.replace(/[^\d]/g, "");
  const waitlistHref = supportDigits
    ? `https://wa.me/${supportDigits}?text=${encodeURIComponent(`Hola, quiero que me avisen cuando el módulo ${props.title} esté disponible.`)}`
    : "/registro";

  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-[1120px] px-6 pt-16 pb-12">
        <div className="grid gap-10 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="text-sm font-medium tracking-wide text-accent">{props.eyebrow}</p>
            <h1 className="mt-3 font-display text-[44px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">
              {props.title}
            </h1>
            <p className="mt-4 text-lg text-ink-2">{props.description}</p>

            {props.status === "available" ? (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href={`/registro?plan=${props.planCode}`} className={buttonVariants({ size: "lg" })}>
                  Prueba 7 días gratis
                </Link>
                <span className="text-sm text-ink-2">Desde {formatCurrency(props.priceMonth)}/mes</span>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href={waitlistHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                  Avísame cuando esté disponible
                </a>
                <span className="text-sm text-ink-2">Próximamente</span>
              </div>
            )}
          </div>

          <div>
            {props.status === "available" ? (
              <div className="overflow-hidden rounded-lg border border-line shadow-lg">
                <Image src={props.screenshotSrc} alt={props.screenshotAlt} width={752} height={634} className="w-full" priority />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-line bg-sunken text-sm text-ink-2">
                Próximamente
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
          <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">Qué incluye</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {props.features.map((f) => {
              const pending = f.includes("en camino");
              return (
                <li key={f} className={cn("flex items-start gap-3 text-ink-2", pending && "italic")}>
                  <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", pending ? "bg-ink-3" : "bg-accent")} />
                  {f}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-4 px-6 py-20 text-center">
          {props.status === "available" ? (
            <>
              <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">
                Empieza hoy, sin tarjeta
              </h2>
              <Link href={`/registro?plan=${props.planCode}`} className={buttonVariants({ size: "lg" })}>
                Prueba 7 días gratis
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-[32px] font-medium leading-[1.15] text-ink">
                Te avisamos en cuanto esté listo
              </h2>
              <a href={waitlistHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Avísame cuando esté disponible
              </a>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
