import Image from "next/image";
import { PDF_PAGES, PREVIEW_PASTA, type Area } from "@/lib/guias";

export default function GuiaSection({ area }: { area: Area }) {
  const gives = [
    ...area.gives,
    "Etapa III com as duas trilhas: crescer onde está e mudar de empresa",
  ];

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
          {gives.map((g) => (
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
          {PDF_PAGES.map((p) => (
            <figure
              key={p.n}
              className="flex-none w-[230px] md:w-[250px] snap-start m-0 flex flex-col items-center gap-3.5"
            >
              <div className="w-full bg-[#FBF8F2] border border-[#E2D8C9] rounded-2xl p-4">
                <Image
                  src={`/previews/${PREVIEW_PASTA[area.slug]}-p${p.n}.jpg`}
                  width={480}
                  height={600}
                  alt={`Página ${Number(p.n)} do guia de ${area.name}: ${p.title}`}
                  sizes="250px"
                  className="w-full aspect-[4/5] object-cover rounded-lg shadow-[0_1px_2px_rgba(60,40,20,.08),0_6px_16px_rgba(60,40,20,.10)]"
                />
              </div>
              <figcaption className="text-[15px] text-[#4A403A] text-center">{p.title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
