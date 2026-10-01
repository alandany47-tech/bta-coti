"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/precios", label: "Precios" },
  { href: "/brokers", label: "Broker" },
  { href: "/servicios", label: "Servicios" },
  { href: "/catalogo", label: "Catálogo" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6">
        <Link href="/" className="font-display text-lg font-medium text-ink" onClick={() => setOpen(false)}>
          {BRAND.name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-2 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn("hover:text-ink", pathname === item.href && "font-medium text-ink")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-ink-2 hover:text-ink sm:inline">
            Iniciar sesión
          </Link>
          <Link href="/registro" className={buttonVariants({ size: "sm" })}>
            Prueba 7 días gratis
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-sunken sm:hidden"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-5 w-5">
              {open ? <path d="M5 5L15 15M15 5L5 15" /> : <path d="M3 6H17M3 10H17M3 14H17" />}
            </svg>
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className={cn(
          "flex-col gap-1 border-t border-line bg-paper px-6 py-3 text-sm text-ink-2 sm:hidden",
          open ? "flex" : "hidden",
        )}
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-2 hover:bg-sunken hover:text-ink",
              pathname === item.href && "font-medium text-ink",
            )}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="rounded-md px-2 py-2 hover:bg-sunken hover:text-ink" onClick={() => setOpen(false)}>
          Iniciar sesión
        </Link>
      </nav>
    </header>
  );
}
