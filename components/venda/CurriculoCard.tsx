"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CV_PREVIEW } from "@/lib/cv-preview";
import type { Area } from "@/lib/guias";

type CvPasta = keyof typeof CV_PREVIEW;

/** Trecho do resumo que, no .docx, vem destacado em amarelo (a partir do resultado recente). */
const MARCA_RESUMO = "Resultado recente";

const SECAO = "mt-1.5 pb-[3px] border-b border-[#1F1A17] text-[10px] font-bold tracking-[.08em]";

/** Mini capa do produto (4:5): fundo da área, "Currículo ATS" e uma folha girada. Decorativa. */
function MiniCapa({ area }: { area: Pick<Area, "ct"> }) {
  return (
    <div aria-hidden="true" className="flex-none w-[60px] h-[75px] md:w-24 md:h-[120px]">
      <div
        className="relative w-24 h-[120px] overflow-hidden rounded-[3px_6px_6px_3px] p-[10.5px] origin-top-left scale-[.625] md:scale-100 shadow-[0_1px_2px_rgba(60,40,20,.10),0_6px_14px_rgba(60,40,20,.16)]"
        style={{ background: area.ct }}
      >
        <span className="block font-serif text-[13.5px] leading-none text-[#F5EFE6]">
          Currículo
          <br />
          ATS
        </span>
        <div className="absolute left-[21px] right-[7.5px] top-[51px] h-[90px] rounded-[2px] bg-[#FBF8F2] -rotate-3 p-[7.5px] flex flex-col gap-[4.5px]">
          <span className="h-1.5 w-[60%] rounded-[1px] bg-[#2A2420]" />
          <span className="h-[3px] w-[90%] bg-[#C9BBA8]" />
          <span className="h-[3px] w-full bg-[#E2D8C9]" />
          <span className="h-[5.3px] w-[80%] bg-[#F3E39A]" />
          <span className="h-[3px] w-[85%] bg-[#E2D8C9]" />
        </div>
      </div>
    </div>
  );
}

function PaginaPrevia({ area, pasta }: { area: Pick<Area, "ct">; pasta: CvPasta }) {
  const cv = CV_PREVIEW[pasta];
  const corte = cv.resumo.indexOf(MARCA_RESUMO);
  const resumoA = corte >= 0 ? cv.resumo.slice(0, corte) : cv.resumo;
  const resumoB = corte >= 0 ? cv.resumo.slice(corte) : "";

  return (
    <div className="relative h-[300px] md:h-[340px] overflow-hidden bg-white border border-[#EDE4D6] rounded-md px-6 py-[22px] flex flex-col gap-1.5 text-[#1F1A17] font-sans">
      <span className="text-[19px] font-semibold">[Seu nome completo]</span>
      <span className="text-[11.5px] font-semibold leading-[1.35]" style={{ color: area.ct }}>
        {cv.headline}
      </span>
      <span className="text-[9.5px] leading-[1.35] text-[#6E635A]">{cv.contact}</span>

      <span className={SECAO}>RESUMO PROFISSIONAL</span>
      <span className="text-[10.5px] leading-[1.45]">
        {resumoA}
        {resumoB && <span className="bg-[#FFF176]">{resumoB}</span>}
      </span>

      <span className={SECAO}>COMPETÊNCIAS</span>
      {cv.comp.map((c) => (
        <span key={c} className="text-[10.5px] leading-[1.4]">
          <b className="font-semibold">{c}:</b> <span className="text-[#6E635A]">…</span>
        </span>
      ))}

      <span className={SECAO}>EXPERIÊNCIA PROFISSIONAL</span>
      <div className="flex justify-between gap-2 text-[11px]">
        <b className="font-semibold">{cv.job[0]}</b>
        <span>{cv.job[1]}</span>
      </div>
      {cv.bullets.map((b) => (
        <span key={b} className="text-[10.5px] leading-[1.45] pl-2.5 -indent-2.5">
          • {b}
        </span>
      ))}

      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[90px] bg-[linear-gradient(rgba(255,255,255,0),#fff_85%)]"
      />
    </div>
  );
}

/**
 * Card "Também incluso": o modelo de currículo ATS que vai junto com o guia.
 * Desktop: a prévia abre com hover e foco de teclado. Celular: abre e fecha com
 * toque. Em qualquer um, Esc e um toque fora fecham.
 */
export default function CurriculoCard({ area, pasta }: { area: Pick<Area, "slug" | "name" | "ct" | "tint">; pasta: string }) {
  const [aberto, setAberto] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previaId = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const aoTocarFora = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoTocarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoTocarFora);
    };
  }, [aberto]);

  const temCurriculo = pasta in CV_PREVIEW;
  if (!temCurriculo) return null;

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      aria-describedby={previaId}
      onPointerEnter={(e) => e.pointerType === "mouse" && setAberto(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setAberto(false)}
      // Foco por teclado abre; foco vindo do toque não (senão o clique logo depois fecharia).
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && setAberto(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
      // Com mouse a prévia já segue o hover; o clique só alterna em telas sem hover.
      onClick={() => {
        if (!window.matchMedia("(hover: hover)").matches) setAberto((v) => !v);
      }}
      className="order-3 md:order-none relative cursor-pointer mx-5 mb-8 md:mx-0 md:mb-0 max-w-[680px] flex items-start gap-3.5 md:gap-5 p-4 md:p-6 rounded-2xl bg-[#FBF8F2] border-[1.5px] outline-offset-4"
      style={{ borderColor: area.ct }}
    >
      <MiniCapa area={area} />

      <div className="flex flex-col gap-2 min-w-0">
        <span
          className="self-start px-2.5 py-[3px] rounded-full text-[11px] font-semibold tracking-[.1em] uppercase"
          style={{ background: area.tint, color: area.ct }}
        >
          Também incluso
        </span>
        <span className="font-serif text-[19px] md:text-2xl leading-[1.2]">Modelo de currículo ATS · {area.name}</span>
        <span className="text-sm md:text-base leading-[1.5] text-[#3A322D]">
          Arquivo .docx com layout que sistemas de triagem como a Gupy conseguem ler, diretrizes passo a passo e um
          prompt pronto para a IA adaptar o seu currículo a cada vaga.
        </span>
        <span className="text-[13px] font-semibold" style={{ color: area.ct }}>
          <span className="hidden md:inline">Passe o mouse para ver o arquivo ↑</span>
          <span className="md:hidden">Toque para ver uma prévia ↑</span>
        </span>
      </div>

      <div
        id={previaId}
        role="tooltip"
        aria-hidden={!aberto}
        className={`pointer-events-none absolute z-30 left-0 right-0 md:right-auto md:w-[480px] bottom-[calc(100%+10px)] flex flex-col gap-2.5 p-3.5 rounded-2xl bg-[#FBF8F2] border border-[#E2D8C9] shadow-[0_2px_6px_rgba(60,40,20,.08),0_24px_48px_rgba(60,40,20,.18)] transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
          aberto ? "opacity-100 translate-y-0" : "invisible opacity-0 translate-y-1"
        }`}
      >
        <PaginaPrevia area={area} pasta={pasta as CvPasta} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A4F47]">
          <span>Prévia · página 1 de 2 · .docx</span>
          <span className="font-semibold" style={{ color: area.ct }}>
            + diretrizes e prompt para IA
          </span>
        </div>
      </div>
    </div>
  );
}
