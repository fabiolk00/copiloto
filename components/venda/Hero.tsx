import { BRAND_NAME, type Area } from "@/lib/guias";
import CtaLink from "./CtaLink";
import HeroSub from "./HeroSub";
import TrilhaSelector from "./TrilhaSelector";

export default function Hero({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-10 py-[88px] pb-24 grid grid-cols-1 md:grid-cols-[1.15fr_.85fr] gap-20 items-center">
      <div className="flex flex-col gap-[26px]">
        <span
          className="inline-flex items-center gap-2 text-[13px] tracking-[.1em] uppercase"
          style={{ color: area.ct }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
          Guia digital · {area.name}
        </span>

        <h1 className="m-0 font-serif font-normal text-[60px] leading-[1.04] tracking-[-.025em] text-pretty">
          {area.h1}
        </h1>

        <HeroSub area={area} />

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
        <div
          className="aspect-[3/4] w-[380px] rounded-[6px_16px_16px_6px] shadow-[0_1px_2px_rgba(60,40,20,.08),0_30px_60px_rgba(60,40,20,.16)] p-9 px-[30px] flex flex-col justify-between border-l-8 rotate-[1.5deg]"
          style={{ background: area.tint, borderColor: area.c }}
        >
          <div
            className="flex justify-between text-xs tracking-[.12em] uppercase"
            style={{ color: area.ct }}
          >
            <span>Guia {area.roman}</span>
            <span>{BRAND_NAME}</span>
          </div>
          <div className="flex flex-col gap-3.5">
            <span className="font-serif text-[42px] leading-[1.02]">
              Carreira em {area.name}
            </span>
            <span className="w-10 h-px" style={{ background: area.c }} />
            <span className="text-[15px] leading-[1.5] text-[#4A403A]">
              Três partes, uma etapa por vez, com a IA como aliada.
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#7A6E64]">[mockup da capa real]</span>
        </div>
      </div>
    </div>
  );
}
