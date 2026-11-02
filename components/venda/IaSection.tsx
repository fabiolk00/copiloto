import type { Area } from "@/lib/guias";
import CopyPromptButton from "./CopyPromptButton";

export default function IaSection({ area }: { area: Area }) {
  return (
    <div id="ia" className="bg-[#2F2925] text-[#F5EFE6] px-10 pt-[104px] pb-28">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-end">
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-2.5 text-[15px] text-[#CFC4B6]">
              <span className="font-serif text-xl text-[#E0B97A]">{"✦"}</span>
              <span className="w-6 h-px bg-[#6A5E55]" />
              <span>IA como aliada</span>
            </div>
            <h2 className="m-0 font-serif font-normal text-[48px] leading-[1.08] tracking-[-.02em] text-pretty">
              Prompts prontos para tirar peso da sua rotina
            </h2>
          </div>
          <p className="m-0 text-lg leading-[1.65] text-[#DDD3C6]">
            Três exemplos do guia. Copie, troque o que está entre colchetes e use na
            ferramenta de IA que você já tem. O guia completo traz [n] prompts organizados
            por etapa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {area.prompts.map(([title, body], i) => (
            <div
              key={title}
              className="bg-[#3A332E] border border-[#4E453F] rounded-2xl flex flex-col"
            >
              <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[#4E453F]">
                <span className="text-base font-semibold">{title}</span>
                <span className="text-xs text-[#B4A898]">{i + 1}/3</span>
              </div>
              <p className="m-0 p-5 flex-1 font-mono text-sm leading-[1.65] text-[#E8DFD3] whitespace-pre-wrap">
                {body}
              </p>
              <div className="px-5 pb-5">
                <CopyPromptButton text={body} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
