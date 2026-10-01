import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const description = "Cotizador para PyMEs: catálogo, precios y envío por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: BRAND.name,
    title: BRAND.name,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${instrumentSans.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
