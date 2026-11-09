import Image from "next/image";
import { PDF_PAGES, PREVIEW_PASTA, type Area } from "@/lib/guias";
import CurriculoCard from "./CurriculoCard";

export default function GuiaSection({ area }: { area: Area }) {
  const gives = [
    ...area.gives,
    "Etapa III com as duas trilhas: crescer onde está e mudar de empresa",
  ];

  return (
    <div
      id="guia"
      className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6 md:gap-20 py-8 md:pt-24 md:pb-[72px] border-t border-[#E6DCCD]"
    >
      <div className="hidden md:flex flex-col gap-3.5">
        <span className="sticky top-[110px] w-[58px] h-[58px] rounded-full bg-[#F5EFE6] border-[1.5px] border-[#8C5E1E] flex items-center justify-center font-serif text-[22px] text-[#8C5E1E]">
          01
        </span>
        <span className="text-[15px] text-[#645950]">O guia</span>
      </div>

      <div className="flex flex-col gap-5 md:gap-7 min-w-0">
        <h2 className="px-5 md:px-0 m-0 font-serif font-normal text-[26px] md:text-[44px] leading-[1.1] tracking-[-.02em]">
          O que você recebe no guia de {area.name}
        </h2>

        <div className="order-2 md:order-none mx-5 md:mx-0 max-w-[680px] flex flex-col border-t border-[#E2D8C9]">
          {gives.map((g, i) => (
            <div
              key={g}
              className={`${i >= 5 ? "hidden md:flex" : "flex"} gap-3 md:gap-4 py-3 md:py-4 border-b border-[#E2D8C9] text-[15px] md:text-lg leading-[1.5] text-[#3A322D]`}
            >
              <span
                className="flex-none w-4 h-4 md:w-[7px] md:h-[7px] mt-0.5 md:mt-2.5 rounded-full md:border-[1.5px] flex items-center justify-center text-[10px] md:text-[0px]"
                style={{ borderColor: area.c, background: area.tint, color: area.ct }}
              >
                {"✓"}
              </span>
              <span>{g}</span>
            </div>
          ))}
        </div>

        <CurriculoCard area={area} pasta={PREVIEW_PASTA[area.slug]} />

        <div className="order-1 md:order-none no-scrollbar flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory md:py-3 md:pr-10 md:pb-4 px-5 md:px-0 scroll-px-5">
          {PDF_PAGES.map((p) => (
            <figure
              key={p.n}
              className="flex-none w-[168px] md:w-[250px] snap-start m-0 flex flex-col items-center gap-2 md:gap-3.5"
            >
              <div className="w-full md:bg-[#FBF8F2] md:border md:border-[#E2D8C9] md:rounded-2xl md:p-4">
                <Image
                  src={`/previews/${PREVIEW_PASTA[area.slug]}-p${p.n}.jpg`}
                  width={480}
                  height={600}
                  alt={`Página ${Number(p.n)} do guia de ${area.name}: ${p.title}`}
                  sizes="(max-width: 767px) 168px, 250px"
                  className="w-full aspect-[4/5] object-cover rounded-lg shadow-[0_1px_2px_rgba(60,40,20,.08),0_6px_16px_rgba(60,40,20,.10)]"
                />
              </div>
              <figcaption className="text-[13px] md:text-[15px] text-[#4A403A] text-center">{p.title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
