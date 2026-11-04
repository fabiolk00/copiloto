"use client";

import { useRef, type KeyboardEvent } from "react";
import { TRILHAS, type Area } from "@/lib/guias";
import { useTrilha } from "./TrilhaProvider";

export default function TrilhaSelector({ area }: { area: Area }) {
  const { trilha, setTrilha } = useTrilha();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const backward = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!forward && !backward) return;
    e.preventDefault();
    const nextIndex = (index + (forward ? 1 : -1) + TRILHAS.length) % TRILHAS.length;
    setTrilha(TRILHAS[nextIndex].id);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="O que você quer agora?"
      className="grid grid-cols-2 md:flex md:flex-col gap-2 md:gap-2.5 md:pt-1.5"
    >
      <span className="col-span-2 font-serif text-[19px] md:text-[21px] leading-[1.25]">O que você quer agora?</span>
      {TRILHAS.map((t, i) => {
        const on = trilha === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!trilha && i === 0) ? 0 : -1}
            onClick={() => setTrilha(on ? null : t.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="min-h-[76px] md:min-h-16 w-full text-left p-3 md:px-4 md:py-3.5 rounded-xl md:rounded-[14px] flex flex-col md:flex-row items-start gap-2 md:gap-3.5 cursor-pointer transition-colors"
            style={{
              border: on ? `2px solid ${area.ct}` : "1px solid #D5C9B8",
              background: on ? "#FBF8F2" : "rgba(251,248,242,.5)",
            }}
          >
            <span
              className="hidden md:flex flex-none mt-0.5 w-[22px] h-[22px] rounded-full items-center justify-center text-[12px] text-[#FBF8F2]"
              style={{
                border: `1.5px solid ${on ? area.ct : "#9C8F82"}`,
                background: on ? area.ct : "transparent",
              }}
            >
              {on ? "✓" : ""}
            </span>
            <span className="flex w-full flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="md:hidden flex-none w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] text-[#FBF8F2]"
                  style={{
                    border: `1.5px solid ${on ? area.ct : "#9C8F82"}`,
                    background: on ? area.ct : "transparent",
                  }}
                >
                  {on ? "✓" : ""}
                </span>
                <span className={`text-[15px] md:text-[17px] leading-tight ${on ? "font-semibold" : "font-medium"}`}>
                  {t.rotulo}
                </span>
              </span>
              <span className="hidden md:block text-[15px] leading-[1.45] text-[#4A403A]">{t.descricao}</span>
              <span className="md:hidden text-[13px] leading-[1.35] text-[#4A403A]">{t.curta}</span>
            </span>
          </button>
        );
      })}
      <span className="col-span-2 text-[13px] md:text-sm text-[#645950]">
        {trilha
          ? "Você pode mudar de ideia a qualquer momento. O guia traz as duas trilhas."
          : "Escolha uma trilha para liberar o guia. O guia traz as duas trilhas; a escolha define a sua etapa III."}
      </span>
    </div>
  );
}
