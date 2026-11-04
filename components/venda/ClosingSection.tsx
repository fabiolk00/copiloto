import { GUARANTEES, type Area } from "@/lib/guias";
import ClosingTrilhaLine from "./ClosingTrilhaLine";
import PixCheckout from "./PixCheckout";

export default function ClosingSection({ area }: { area: Area }) {
  return (
    <div id="fechamento" className="px-5 md:px-10 pt-8 md:pt-10 pb-28 md:pb-[120px] flex justify-center border-t border-[#E6DCCD] md:border-0">
      <div className="w-full max-w-[1040px] bg-[#FBF8F2] border border-[#E2D8C9] rounded-[18px] md:rounded-[28px] px-5 py-[22px] md:p-16 md:px-[72px] grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 md:gap-16 items-center shadow-[0_1px_2px_rgba(60,40,20,.04),0_16px_40px_rgba(60,40,20,.07)]">
        <div className="flex flex-col gap-5">
          <span
            className="inline-flex items-center gap-2 text-xs md:text-[13px] tracking-[.1em] uppercase"
            style={{ color: area.ct }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
            Guia {area.roman} · {area.name}
          </span>
          <h2 className="m-0 font-serif font-normal text-2xl md:text-[40px] leading-[1.15] md:leading-[1.1] tracking-[-.02em]">
            Comece pela parte I esta semana.
          </h2>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-serif text-[40px] md:text-[56px] leading-none tracking-[-.02em] whitespace-nowrap">
              R$ 29,90
            </span>
            <span className="text-[15px] text-[#645950]">pagamento único</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 justify-center">
          {GUARANTEES.map((g) => (
            <div key={g} className="flex gap-3 items-center text-sm md:text-[17px] text-[#3A322D]">
              <span
                className="flex-none w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px]"
                style={{ background: area.tint, color: area.ct }}
              >
                {"✓"}
              </span>
              {g}
            </div>
          ))}
          <ClosingTrilhaLine area={area} />
          <PixCheckout
            area={area.slug}
            areaName={area.name}
            className="mt-2 min-h-[52px] md:min-h-15 rounded-xl md:rounded-2xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-base md:text-lg font-semibold flex items-center justify-center gap-[5px] px-3 whitespace-nowrap hover:bg-[#6F4914] hover:text-[#FBF8F2] disabled:opacity-70 disabled:cursor-wait"
          >
            <span className="hidden md:inline">Quero o guia de {area.name}</span>
            <span className="md:hidden">Quero o guia {area.name}</span>
          </PixCheckout>
          <span className="text-sm text-[#645950] text-center">
            Pagamento seguro · PDF enviado por e-mail
          </span>
        </div>
      </div>
    </div>
  );
}
