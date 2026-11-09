import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/guias";

// Imagem OG 1200x630 gerada em build (estática). Herdada por todas as rotas
// que não definem a própria; sem arte de terceiros nem dados inventados.
export const alt = `${BRAND_NAME}: guias de carreira em PDF com prompts de IA`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "#F4EEE3",
          color: "#2A2420",
        }}
      >
        <div style={{ fontSize: 84, lineHeight: 1.05 }}>{BRAND_NAME}</div>
        <div style={{ fontSize: 40, marginTop: 28, color: "#4A403A" }}>
          Guias de carreira em PDF com prompts de IA
        </div>
      </div>
    ),
    size,
  );
}
