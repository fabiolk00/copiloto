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
      className="flex flex-col gap-2.5 pt-1.5"
    >
      <span className="font-serif text-[21px] leading-[1.25]">O que você quer agora?</span>
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
            className="min-h-16 w-full text-left px-4 py-3.5 rounded-[14px] flex items-start gap-3.5 cursor-pointer transition-colors"
            style={{
              border: on ? `2px solid ${area.ct}` : "1px solid #D5C9B8",
              background: on ? "#FBF8F2" : "rgba(251,248,242,.5)",
            }}
          >
            <span
              className="flex-none mt-0.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] text-[#FBF8F2]"
              style={{
                border: `1.5px solid ${on ? area.ct : "#9C8F82"}`,
                background: on ? area.ct : "transparent",
              }}
            >
              {on ? "✓" : ""}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={`text-[17px] ${on ? "font-semibold" : "font-medium"}`}>
                {t.rotulo}
              </span>
              <span className="text-[15px] leading-[1.45] text-[#4A403A]">{t.descricao}</span>
            </span>
          </button>
        );
      })}
      <span className="text-sm text-[#645950]">
        {trilha
          ? "Você pode mudar de ideia a qualquer momento. O guia traz as duas trilhas."
          : "Escolha uma trilha para liberar o guia. O guia traz as duas trilhas; a escolha define a sua etapa III."}
      </span>
    </div>
  );
}
