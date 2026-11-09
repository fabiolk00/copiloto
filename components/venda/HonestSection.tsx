import type { Area } from "@/lib/guias";

export default function HonestSection({ area }: { area: Area }) {
  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:pt-28 md:pb-10">
      <div className="bg-[#EDE4D6] rounded-[18px] md:rounded-[28px] px-5 py-6 md:p-[72px] md:px-20 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-4 md:gap-12">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5 text-sm text-[#645950]">
            <span className="font-serif text-lg text-[#7A5214]">03</span>
            <span className="w-6 h-px bg-[#B8A891]" />
          </div>
          <span className="text-[15px] text-[#645950]">Uma palavra honesta</span>
          <span className="hidden md:block font-serif text-[120px] leading-[.7] text-[#8C5E1E]">{"“"}</span>
        </div>

        <div className="max-w-[680px] flex flex-col gap-3 md:gap-[22px]">
          <h2 className="m-0 font-serif font-normal text-[22px] md:text-[46px] leading-[1.08] tracking-[-.02em] text-pretty">
            {area.honestT}
          </h2>
          <p className="m-0 text-sm md:text-lg leading-[1.5] md:leading-[1.7] text-[#3A322D] text-pretty">{area.honest}</p>
        </div>
      </div>
    </div>
  );
}
