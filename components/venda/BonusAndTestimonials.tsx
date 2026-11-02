import type { Area } from "@/lib/guias";

export default function BonusAndTestimonials({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-10 pb-20 grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-6">
      <div className="border border-[#E2D8C9] rounded-[20px] bg-[#FBF8F2] p-7 flex flex-col gap-4">
        <span className="text-[13px] tracking-[.08em] uppercase text-[#645950]">
          Complemento opcional
        </span>
        <div className="flex gap-[18px]">
          <span
            className="flex-none w-[60px] h-[76px] rounded-sm border border-[#E2D8C9]"
            style={{
              background:
                "repeating-linear-gradient(135deg,#EDE4D6 0 6px,#E4D9C9 6px 12px)",
            }}
          />
          <div className="flex flex-col gap-1.5">
            <span className="font-serif text-[22px] leading-[1.2]">{area.bonus}</span>
            <span className="text-base leading-[1.55] text-[#4A403A]">{area.bonusD}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-[15px] text-[#4A403A]">+ R$ [preço]</span>
          <button
            type="button"
            className="min-h-11 px-[18px] rounded-xl border-[1.5px] border-[#2A2420] bg-transparent text-[#2A2420] text-[15px] font-semibold cursor-pointer hover:bg-[#2A2420] hover:text-[#FBF8F2]"
          >
            Adicionar ao pedido
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <span className="text-[13px] tracking-[.08em] uppercase text-[#645950]">
          Relatos de quem usou
        </span>
        <div className="flex-1 border-[1.5px] border-dashed border-[#C9BBA8] rounded-[20px] p-7 flex flex-col justify-center gap-2.5 bg-[#FBF8F2]/50">
          <span className="font-serif text-2xl">Os primeiros relatos ainda estão chegando.</span>
          <span className="text-base text-[#4A403A]">
            Preferimos mostrar este espaço vazio a inventar depoimentos.
          </span>
          <span className="font-mono text-[13px] text-[#7A6E64]">[inserir depoimento real]</span>
        </div>
      </div>
    </div>
  );
}
