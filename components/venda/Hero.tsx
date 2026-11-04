import type { Area } from "@/lib/guias";
import CapaLivro from "./CapaLivro";
import CtaLink from "./CtaLink";
import TrilhaSelector from "./TrilhaSelector";

const CHIPS_IA = ["IA no seu trabalho", "IA no seu currículo", "Prompts prontos"];

export default function Hero({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-10 py-[88px] pb-24 grid grid-cols-1 md:grid-cols-[1.15fr_.85fr] gap-20 items-center">
      <div className="flex flex-col gap-[26px]">
        <span
          className="inline-flex items-center gap-2 text-[13px] tracking-[.1em] uppercase"
          style={{ color: area.ct }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
          Guia digital · {area.name} · com IA
        </span>

        <h1 className="m-0 font-serif font-normal text-[60px] leading-[1.04] tracking-[-.025em] text-pretty">
          {area.h1}
        </h1>

        <div className="rounded-2xl bg-[#2F2925] text-[#F5EFE6] p-[18px] md:px-[22px] md:py-5 flex gap-3.5 items-start">
          <span aria-hidden="true" className="font-serif text-[26px] md:text-[30px] leading-none text-[#E0B97A]">
            ✦
          </span>
          <div className="flex flex-col gap-3.5">
            <p className="m-0 font-serif text-xl md:text-2xl leading-[1.3]">
              Vou mudar o jeito que você entende a IA e a aplica no seu trabalho e no seu currículo.
            </p>
            <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
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

        <div className="flex flex-col gap-2.5 pt-1.5">
          <CtaLink
            area={area.slug}
            posicao="hero"
            href="#fechamento"
            className="min-h-[58px] px-[30px] rounded-2xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-[17px] font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
          >
            Quero o guia · R$ 29,90
          </CtaLink>
          <span className="text-sm text-[#645950] text-center">
            Pagamento único · PDF no seu e-mail
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <CapaLivro area={area} />
      </div>
    </div>
  );
}
