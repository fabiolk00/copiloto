import { ImageResponse } from "next/og";
import { BRAND_NAME, getAllSlugs, getAreaBySlug } from "@/lib/guias";

// Imagem OG 1200x630 por guia (META-05), gerada em build a partir dos dados
// reais da área (nome, cor e H1). Sem arte de terceiros nem dados inventados.
export const alt = `Guia em PDF, ${BRAND_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllSlugs().map((area) => ({ area }));
}

export default async function Image({ params }: { params: Promise<{ area: string }> }) {
  const { area: slug } = await params;
  const area = getAreaBySlug(slug);
  const nome = area?.name ?? BRAND_NAME;
  const cor = area?.c ?? "#8C5E1E";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 88,
          background: "#F4EEE3",
          color: "#2A2420",
          borderLeft: `24px solid ${cor}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#645950", letterSpacing: 2 }}>
          {BRAND_NAME.toUpperCase()} · GUIA EM PDF
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 88, lineHeight: 1.05 }}>{`Guia de ${nome}`}</div>
          {area && (
            <div style={{ display: "flex", fontSize: 36, marginTop: 28, color: "#4A403A", lineHeight: 1.3 }}>{area.h1}</div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#4A403A" }}>8 semanas · 3 partes · prompts de IA</div>
      </div>
    ),
    size,
  );
}
