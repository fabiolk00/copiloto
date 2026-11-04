"use client";

import LogoSimbolo from "@/components/LogoSimbolo";
import { BRAND_NAME, type Area, type Trilha } from "@/lib/guias";
import { useTrilha } from "./TrilhaProvider";

/**
 * Capa do livro do hero. Desenhada para 380 px de largura (290 px no celular):
 * todas as medidas internas são `cqw` (unidade de container), então a capa
 * inteira escala junto com a largura, sem breakpoints por medida.
 */
const S = (px: number) => `${((px / 380) * 100).toFixed(3)}cqw`;

const ROTULO_TRILHA: Record<Trilha, string> = {
  crescer: "Crescer na empresa",
  mudar: "Mudar de empresa",
};
const ROMANOS = ["I", "II", "III"];
const SEMANAS = ["Semanas 1 e 2", "Semanas 3 a 5", "Semanas 6 a 8"];

export default function CapaLivro({ area }: { area: Area }) {
  const { trilha } = useTrilha();
  const rotulo = trilha ? ROTULO_TRILHA[trilha] : "Duas trilhas";

  return (
    <div
      className="relative w-[290px] md:w-[380px] aspect-[4/5] rotate-[1.5deg]"
      style={{ containerType: "inline-size" }}
    >
      {/* Folhas atrás, à direita */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          top: S(6),
          bottom: S(6),
          right: S(-10),
          width: S(14),
          borderRadius: `0 ${S(4)} ${S(4)} 0`,
          background: "repeating-linear-gradient(180deg,#FBF8F2 0 2px,#E6DCCD 2px 3px)",
          boxShadow: "0 10px 30px rgba(60,40,20,.12)",
        }}
      />

      {/* Corpo */}
      <div
        className="relative h-full flex flex-col overflow-hidden text-[#F5EFE6]"
        style={{
          background: area.ct,
          borderRadius: `${S(4)} ${S(10)} ${S(10)} ${S(4)}`,
          padding: `${S(26)} ${S(24)} ${S(20)} ${S(34)}`,
          boxShadow: "0 1px 2px rgba(60,40,20,.10), 0 30px 60px rgba(60,40,20,.20)",
        }}
      >
        {/* Lombada */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0"
          style={{
            width: S(14),
            background:
              "linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,.04) 60%, rgba(255,255,255,.10))",
          }}
        />

        {/* Topo */}
        <div className="flex items-center justify-between" style={{ gap: S(8) }}>
          <span className="flex items-center" style={{ gap: S(7) }}>
            <LogoSimbolo
              size={15}
              tinta="#F5EFE6"
              destaque="#F5EFE6"
              className="flex-none"
              style={{ width: S(15), height: S(15) }}
            />
            <span className="font-serif" style={{ fontSize: S(13) }}>
              {BRAND_NAME}
            </span>
          </span>
          <span
            className="uppercase whitespace-nowrap"
            style={{ fontSize: S(9), letterSpacing: ".14em" }}
          >
            Guia digital
          </span>
        </div>

        {/* Rótulo, título e frase */}
        <span
          className="uppercase opacity-[.92]"
          style={{ marginTop: S(44), fontSize: S(9), letterSpacing: ".14em" }}
        >
          Guia de carreira · {rotulo}
        </span>
        <span
          className="font-serif font-normal text-balance"
          style={{ marginTop: S(8), fontSize: S(56), lineHeight: 0.98, letterSpacing: "-.025em" }}
        >
          {area.name}
        </span>
        <span
          className="text-pretty"
          style={{ marginTop: S(12), fontSize: S(13.5), lineHeight: 1.4, maxWidth: S(290) }}
        >
          {area.h1}
        </span>

        {/* Etapas */}
        <div className="mt-auto flex flex-col">
          {ROMANOS.map((romano, i) => (
            <div
              key={romano}
              className="grid items-baseline"
              style={{
                gridTemplateColumns: `${S(36)} minmax(0,1fr) auto`,
                gap: S(6),
                padding: `${S(7)} 0`,
                borderTop: "1px solid rgba(245,239,230,.35)",
              }}
            >
              <span className="font-serif" style={{ fontSize: S(17) }}>
                {romano}
              </span>
              <span
                className="font-serif min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontSize: S(14) }}
              >
                {area.parts[i]}
              </span>
              <span
                className="uppercase whitespace-nowrap opacity-90"
                style={{ fontSize: S(9), letterSpacing: ".1em" }}
              >
                {SEMANAS[i]}
              </span>
            </div>
          ))}
        </div>

        {/* Progresso */}
        <div
          className="grid grid-cols-3"
          style={{ marginTop: S(12), gap: S(5) }}
          aria-hidden="true"
        >
          {[0, 1, 2].map((n) => (
            <span
              key={n}
              style={{ height: 3, borderRadius: 2, background: "rgba(245,239,230,.4)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
