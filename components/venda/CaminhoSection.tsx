import { PART_NAMES, PART_WEEKS, type Area } from "@/lib/guias";
import CaminhoBranches from "./CaminhoBranches";

const ROMANS = ["I", "II", "III"] as const;

export default function CaminhoSection({ area }: { area: Area }) {
  return (
    <div
      id="caminho"
      className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6 md:gap-20 px-5 md:px-0 py-8 md:pt-[72px] md:pb-28 border-t border-[#E6DCCD] md:border-0"
    >
      <div className="hidden md:flex flex-col gap-3.5">
        <span className="sticky top-[110px] w-[58px] h-[58px] rounded-full bg-[#F5EFE6] border-[1.5px] border-[#8C5E1E] flex items-center justify-center font-serif text-[22px] text-[#8C5E1E]">
          02
        </span>
        <span className="text-[15px] text-[#645950]">O caminho</span>
      </div>

      <div className="flex flex-col gap-5 md:gap-8">
        <h2 className="m-0 font-serif font-normal text-[26px] md:text-[44px] leading-[1.1] tracking-[-.02em]">
          Oito semanas, sem pressa
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-0 relative">
          <span
            className="hidden md:block absolute left-7 right-[28%] top-7 h-[1.5px] opacity-45"
            style={{ background: area.c }}
          />
          {area.parts.map((description, i) => (
            <div
              key={description}
              className="relative grid grid-cols-[36px_minmax(0,1fr)] md:flex md:flex-col gap-x-3 gap-y-1 md:gap-3 md:pr-8"
            >
              <span
                className="row-span-3 md:row-auto w-9 h-9 md:w-14 md:h-14 rounded-full border-[1.5px] font-serif text-base md:text-[21px] flex items-center justify-center"
                style={{
                  borderColor: area.c,
                  background: i === 0 ? area.c : "#FBF8F2",
                  color: i === 0 ? "#FBF8F2" : area.ct,
                }}
              >
                {ROMANS[i]}
              </span>
              <span
                className="md:mt-2 text-xs md:text-[13px] tracking-[.08em] uppercase"
                style={{ color: area.ct }}
              >
                Parte {ROMANS[i]} · {PART_WEEKS[i]}
              </span>
              <h3 className="m-0 font-serif font-normal text-[19px] md:text-[27px] leading-[1.2]">
                {PART_NAMES[i]}
              </h3>
              <p className="m-0 text-sm md:text-[17px] leading-[1.5] md:leading-[1.6] text-[#4A403A]">{description}</p>
            </div>
          ))}
        </div>

        <CaminhoBranches area={area} />
      </div>
    </div>
  );
}
