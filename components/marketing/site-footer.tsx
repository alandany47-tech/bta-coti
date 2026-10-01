"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

const LINKS = [
  { href: "/legal/terminos", label: "Términos" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/ayuda", label: "Ayuda" },
];

export function SiteFooter() {
  const pathname = usePathname();
  const supportDigits = SUPPORT_WHATSAPP.replace(/[^\d]/g, "");
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-10 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {BRAND.name}. Hecho en México.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn("hover:text-ink", pathname === item.href && "font-medium text-ink")}
            >
              {item.label}
            </Link>
          ))}
          {supportDigits ? (
            <a
              href={`https://wa.me/${supportDigits}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              Soporte por WhatsApp
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
