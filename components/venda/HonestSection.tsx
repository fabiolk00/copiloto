import type { Area } from "@/lib/guias";

export default function HonestSection({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-10 pt-28 pb-10">
      <div className="bg-[#EDE4D6] rounded-[28px] p-10 md:p-[72px] md:px-20 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-12">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5 text-sm text-[#645950]">
            <span className="font-serif text-lg text-[#8C5E1E]">03</span>
            <span className="w-6 h-px bg-[#B8A891]" />
          </div>
          <span className="text-[15px] text-[#645950]">Uma palavra honesta</span>
          <span className="font-serif text-[120px] leading-[.7] text-[#8C5E1E]">{"“"}</span>
        </div>

        <div className="max-w-[680px] flex flex-col gap-[22px]">
          <h2 className="m-0 font-serif font-normal text-[46px] leading-[1.08] tracking-[-.02em] text-pretty">
            {area.honestT}
          </h2>
          <p className="m-0 text-lg leading-[1.7] text-[#3A322D] text-pretty">{area.honest}</p>
          <p className="m-0 text-lg leading-[1.7] text-[#3A322D]">
            Se não fizer sentido para você, os 7 dias de garantia existem para isso.
          </p>
        </div>
      </div>
    </div>
  );
}
