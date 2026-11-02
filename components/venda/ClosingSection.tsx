import { GUARANTEES, type Area } from "@/lib/guias";
import ClosingTrilhaLine from "./ClosingTrilhaLine";
import PixCheckout from "./PixCheckout";

export default function ClosingSection({ area }: { area: Area }) {
  return (
    <div id="fechamento" className="px-10 pt-10 pb-[120px] flex justify-center">
      <div className="w-full max-w-[880px] bg-[#FBF8F2] border border-[#E2D8C9] rounded-[28px] p-14 md:px-16 grid grid-cols-1 md:grid-cols-2 gap-14 shadow-[0_1px_2px_rgba(60,40,20,.04),0_16px_40px_rgba(60,40,20,.07)]">
        <div className="flex flex-col gap-5">
          <span
            className="inline-flex items-center gap-2 text-[13px] tracking-[.1em] uppercase"
            style={{ color: area.ct }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
            Guia {area.roman} · {area.name}
          </span>
          <h2 className="m-0 font-serif font-normal text-[40px] leading-[1.1] tracking-[-.02em]">
            Comece pela parte I esta semana.
          </h2>
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[56px] leading-none tracking-[-.02em]">
              R$ 29,90
            </span>
            <span className="text-[15px] text-[#645950]">pagamento único</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 justify-center">
          {GUARANTEES.map((g) => (
            <div key={g} className="flex gap-3 items-center text-[17px] text-[#3A322D]">
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
            className="mt-2 min-h-15 rounded-2xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-lg font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2] disabled:opacity-70 disabled:cursor-wait"
          >
            Quero o guia de {area.name}
          </PixCheckout>
          <span className="text-sm text-[#645950] text-center">
            Pagamento seguro · PDF enviado por e-mail
          </span>
        </div>
      </div>
    </div>
  );
}
