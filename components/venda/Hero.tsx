import Image from "next/image";
import type { Area } from "@/lib/guias";
import { PREVIEW_PASTA, formatarPreco, precoDaArea } from "@/lib/guias";
import CapaLivro from "./CapaLivro";
import CtaLink from "./CtaLink";
import TrilhaSelector from "./TrilhaSelector";

const CHIPS_IA = ["IA no seu trabalho", "IA no seu currículo", "Prompts prontos"];

export default function Hero({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-5 pt-6 pb-8 md:px-10 md:py-[88px] md:pb-24 grid grid-cols-1 md:grid-cols-[1.15fr_.85fr] gap-4 md:gap-20 items-center">
      <div className="flex flex-col gap-4 md:gap-[26px]">
        <span
          className="inline-flex items-center gap-2 text-xs md:text-[13px] tracking-[.1em] uppercase"
          style={{ color: area.ct }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
          Guia digital · {area.name} · com IA
        </span>

        <h1 className="m-0 font-serif font-normal text-[31px] leading-[1.12] tracking-[-.02em] text-balance md:text-[60px] md:leading-[1.04] md:tracking-[-.025em] md:text-pretty">
          {area.h1}
        </h1>

        <div className="rounded-[14px] md:rounded-2xl bg-[#2F2925] text-[#F5EFE6] px-4 py-3.5 md:px-[22px] md:py-5 flex gap-3.5 items-start">
          <span aria-hidden="true" className="font-serif text-xl md:text-[30px] leading-none text-[#E0B97A]">
            ✦
          </span>
          <div className="flex flex-col gap-3.5">
            <p className="m-0 font-serif text-[15px] md:text-2xl leading-[1.4] md:leading-[1.3]">
              Vou mudar o jeito que você entende a IA e a aplica no seu <strong className="md:font-normal text-[#E0B97A] md:text-inherit">trabalho</strong> e no seu <strong className="md:font-normal text-[#E0B97A] md:text-inherit">currículo</strong>.
            </p>
            <ul className="m-0 p-0 list-none hidden md:flex flex-wrap gap-2">
              {CHIPS_IA.map((chip) => (
                <li
                  key={chip}
                  className="px-3 py-[5px] rounded-full border border-[#6A5E55] text-sm text-[#E8DFD3]"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <TrilhaSelector area={area} />

        <div className="flex flex-col gap-2.5 md:pt-1.5">
          <CtaLink
            area={area.slug}
            posicao="hero"
            href="#fechamento"
            className="min-h-[52px] md:min-h-[58px] px-[30px] rounded-xl md:rounded-2xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-base md:text-[17px] font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
          >
            Quero o guia · {formatarPreco(precoDaArea(area))}
          </CtaLink>
          <span className="text-sm text-[#645950] text-center">
            Pagamento único · PDF e currículo no seu e-mail
          </span>
        </div>
      </div>

      <div className="hidden md:flex justify-center">
        <CapaLivro area={area} />
      </div>

      <div className="md:hidden flex gap-3.5 p-3 border border-[#E2D8C9] rounded-[14px] bg-[#FBF8F2] items-center">
        <Image
          src={`/previews/${PREVIEW_PASTA[area.slug]}-p01.jpg`}
          width={64}
          height={80}
          alt={`Capa do guia de ${area.name}`}
          // Acima da dobra no mobile: sem lazy (CWV-04). Não é o LCP (o H1 é), então sem preload.
          loading="eager"
          className="flex-none w-16 h-20 object-cover rounded-md shadow-[0_1px_2px_rgba(60,40,20,.08),0_4px_10px_rgba(60,40,20,.10)]"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Guia em PDF + currículo ATS</span>
          <span className="text-[13px] leading-[1.4] text-[#645950]">Etapas semanais curtas e prompts prontos para usar.</span>
        </div>
      </div>
    </div>
  );
}
