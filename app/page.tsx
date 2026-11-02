import Link from "next/link";
import { AREAS, BRAND_NAME } from "@/lib/guias";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-10 py-24">
      <div className="max-w-[560px] flex flex-col gap-8 text-center">
        <span className="font-serif text-[28px]">{BRAND_NAME}</span>
        <p className="m-0 text-lg leading-[1.6] text-[#4A403A]">
          Guias digitais por profissão, em três partes, com prompts de IA prontos para usar.
          Escolha a sua área para ver o guia completo.
        </p>
        <div className="flex flex-col gap-3">
          {AREAS.map((area) => (
            <Link
              key={area.slug}
              href={`/${area.slug}`}
              className="min-h-14 rounded-2xl border border-[#E2D8C9] bg-[#FBF8F2] flex items-center justify-center gap-2.5 no-underline text-[#2A2420] text-base font-medium"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: area.c }} />
              {area.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
