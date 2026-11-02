import { PDF_PAGES, type Area } from "@/lib/guias";

export default function GuiaSection({ area }: { area: Area }) {
  return (
    <div
      id="guia"
      className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-20 pt-24 pb-[72px] border-t border-[#E6DCCD]"
    >
      <div className="flex flex-col gap-3.5">
        <span className="sticky top-[110px] w-[58px] h-[58px] rounded-full bg-[#F5EFE6] border-[1.5px] border-[#8C5E1E] flex items-center justify-center font-serif text-[22px] text-[#8C5E1E]">
          01
        </span>
        <span className="text-[15px] text-[#645950]">O guia</span>
      </div>

      <div className="flex flex-col gap-7 min-w-0">
        <h2 className="m-0 font-serif font-normal text-[44px] leading-[1.1] tracking-[-.02em]">
          O que você recebe
        </h2>

        <div className="max-w-[680px] flex flex-col border-t border-[#E2D8C9]">
          {area.gives.map((g) => (
            <div
              key={g}
              className="flex gap-4 py-4 border-b border-[#E2D8C9] text-lg leading-[1.5] text-[#3A322D]"
            >
              <span
                className="flex-none w-[7px] h-[7px] mt-2.5 rounded-full border-[1.5px]"
                style={{ borderColor: area.c }}
              />
              <span>{g}</span>
            </div>
          ))}
        </div>

        <div className="no-scrollbar flex gap-5 overflow-x-auto snap-x snap-mandatory py-3 pr-10 pb-4">
          {PDF_PAGES.map((p, i) => (
            <div
              key={p.title}
              className="flex-none w-[230px] snap-start flex flex-col gap-2.5"
            >
              <div
                className="aspect-[3/4] rounded-lg border border-[#E2D8C9] shadow-[0_8px_20px_rgba(60,40,20,.08)] flex items-end p-3"
                style={{
                  background:
                    "repeating-linear-gradient(135deg,#FBF8F2 0 8px,#F1E9DD 8px 16px)",
                }}
              >
                <span className="font-mono text-[11px] text-[#645950]">
                  [página do PDF · {p.ph}]
                </span>
              </div>
              <span className="text-sm text-[#4A403A]">
                {String(i + 1).padStart(2, "0")} · {p.title}
              </span>
            </div>
          ))}
        </div>
        <span className="text-sm text-[#645950]">Deslize para ver mais páginas →</span>
      </div>
    </div>
  );
}
