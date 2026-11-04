"use client";

import type { Area, Trilha } from "@/lib/guias";
import { useTrilha } from "./TrilhaProvider";

const BRANCH_LABELS: Record<Trilha, string> = {
  crescer: "Crescer onde estou",
  mudar: "Mudar de emprego",
};

const BRANCH_ORDER: Trilha[] = ["crescer", "mudar"];

export default function CaminhoBranches({ area }: { area: Area }) {
  const { trilha } = useTrilha();

  return (
    <div
      className="grid grid-cols-2 md:flex md:flex-col gap-2 md:gap-3 md:ml-[23px] md:pl-5 md:[border-left:1.5px_dashed_var(--ramo)]"
      style={{ "--ramo": area.c } as React.CSSProperties}
    >
      <span className="col-span-2 text-[13px] md:text-sm text-[#645950] md:-ml-1">
        {trilha
          ? "Na etapa III o caminho se divide. A sua ramificação está em destaque."
          : "Na etapa III o caminho se divide em duas ramificações:"}
      </span>
      {BRANCH_ORDER.map((id) => {
        const branch = area.parteIII[id];
        const on = trilha === id;
        const off = trilha !== null && !on;
        return (
          <div
            key={id}
            className="relative rounded-xl md:rounded-2xl p-3 md:p-[18px] flex flex-col gap-2 transition-all duration-200"
            style={{
              border: on ? `2px solid ${area.ct}` : off ? "1px dashed #C9BBA8" : "1px solid #E2D8C9",
              background: off ? "transparent" : "#FBF8F2",
              opacity: off ? 0.72 : 1,
            }}
          >
            <span
              className="hidden md:block absolute w-5"
              style={{ left: "-21px", top: "28px", height: "1.5px", background: area.c }}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] md:text-[13px] tracking-[.08em] uppercase" style={{ color: area.ct }}>
                III · {BRANCH_LABELS[id]}
              </span>
              {on && (
                <span
                  className="text-xs font-semibold px-2 py-[3px] rounded-full text-[#FBF8F2]"
                  style={{ background: area.ct }}
                >
                  ✓ Sua trilha
                </span>
              )}
            </div>
            <h4
              className={`m-0 font-serif text-base md:text-[22px] leading-[1.2] ${on ? "font-medium" : "font-normal"}`}
            >
              {branch.titulo}
            </h4>
            <p className="hidden md:block m-0 text-base leading-[1.55] text-[#4A403A]">{branch.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
