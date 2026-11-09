"use client";

import { useEffect, useState } from "react";
import { formatarPreco, precoDaArea } from "@/lib/guias";
import CtaLink from "./CtaLink";

/**
 * Barra fixa de compra, só no mobile. Aparece depois do hero (scrollY > 560)
 * e some do fechamento em diante (fechamento, outros guias, rodapé).
 */
export default function StickyBuyBar({ area }: { area: string }) {
  const [passouHero, setPassouHero] = useState(false);
  const [fechamentoVisivel, setFechamentoVisivel] = useState(false);

  useEffect(() => {
    const onScroll = () => setPassouHero(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Some do fechamento em diante: o fechamento, "Outros guias" e o rodapé não
  // podem ficar cobertos pela barra fixa no mobile.
  useEffect(() => {
    const alvos = ["fechamento", "outros-guias", "rodape"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (alvos.length === 0) return;
    const visiveis = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visiveis.add(e.target);
        else visiveis.delete(e.target);
      }
      setFechamentoVisivel(visiveis.size > 0);
    });
    alvos.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const visivel = passouHero && !fechamentoVisivel;
  const preco = formatarPreco(precoDaArea({ slug: area }));

  return (
    <div
      aria-hidden={!visivel}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#E2D8C9] bg-[rgba(245,239,230,.97)] px-4 pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom))] transition-transform duration-[250ms] ease-in-out"
      style={{ transform: visivel ? "translateY(0)" : "translateY(110%)" }}
    >
      <div className="flex flex-col leading-tight">
        <span className="font-serif text-xl">{preco}</span>
        <span className="text-xs text-[#645950]">PDF e currículo no seu e-mail</span>
      </div>
      <CtaLink
        area={area}
        posicao="closing"
        href="#fechamento"
        tabIndex={visivel ? 0 : -1}
        className="min-h-[46px] px-6 rounded-xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-base font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2] whitespace-nowrap"
      >
        Quero o guia
      </CtaLink>
    </div>
  );
}
