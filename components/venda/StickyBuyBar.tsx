"use client";

import { useEffect, useState } from "react";
import { PRICE_BRL } from "@/lib/guias";
import CtaLink from "./CtaLink";

/**
 * Barra fixa de compra, só no mobile. Aparece depois do hero (scrollY > 560)
 * e some quando o fechamento entra na tela.
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

  useEffect(() => {
    const alvo = document.getElementById("fechamento");
    if (!alvo) return;
    const io = new IntersectionObserver(([entry]) => setFechamentoVisivel(entry.isIntersecting));
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  const visivel = passouHero && !fechamentoVisivel;
  const preco = PRICE_BRL.toFixed(2).replace(".", ",");

  return (
    <div
      aria-hidden={!visivel}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#E2D8C9] bg-[rgba(245,239,230,.97)] px-4 pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom))] transition-transform duration-[250ms] ease-in-out"
      style={{ transform: visivel ? "translateY(0)" : "translateY(110%)" }}
    >
      <div className="flex flex-col leading-tight">
        <span className="font-serif text-xl">R$ {preco}</span>
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
