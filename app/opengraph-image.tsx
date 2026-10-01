import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadNewsreader(weight: 500 | 600) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Newsreader:wght@${weight}&display=swap`,
  ).then((res) => res.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/);
  const url = match?.[1] ?? css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error("No se encontró la fuente Newsreader en la respuesta de Google Fonts");
  return fetch(url).then((res) => res.arrayBuffer());
}

export default async function Image() {
  const [newsreaderMedium, newsreaderSemibold] = await Promise.all([
    loadNewsreader(500),
    loadNewsreader(600),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F7F6F3",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "#B4532A", display: "flex" }} />
          <div style={{ fontFamily: "Newsreader", fontWeight: 600, fontSize: 32, color: "#1A1917", display: "flex" }}>
            {BRAND.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 920 }}>
          <div
            style={{
              fontFamily: "Newsreader",
              fontWeight: 500,
              fontSize: 64,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: "#1A1917",
              display: "flex",
            }}
          >
            Cotizaciones que cierran ventas, listas en un minuto.
          </div>
          <div style={{ fontFamily: "Newsreader", fontWeight: 500, fontSize: 22, color: "#4A4843", display: "flex" }}>
            Catálogo, precios y envío por WhatsApp — para brokers, talleres y negocios de servicio.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#2E6B4F", display: "flex" }} />
          <div style={{ fontFamily: "Newsreader", fontWeight: 500, fontSize: 20, color: "#8A867D", display: "flex" }}>
            {BRAND.domain}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: newsreaderMedium, weight: 500, style: "normal" },
        { name: "Newsreader", data: newsreaderSemibold, weight: 600, style: "normal" },
      ],
    },
  );
}
