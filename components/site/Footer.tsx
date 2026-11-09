import Link from "next/link";
import { AREAS, BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";
import { PAGINAS_INSTITUCIONAIS, paginasVisiveis } from "@/lib/institucional";

/**
 * Rodapé global (layout raiz): links rastreáveis para os 6 guias em todas as
 * páginas (CON-06) e para as páginas institucionais já publicadas (CON-04).
 * Rascunhos não publicados só aparecem fora de produção.
 */
export default function Footer() {
  const institucionais = paginasVisiveis();
  return (
    <footer id="rodape" className="border-t border-[#E6DCCD] bg-[#EFE7DB] text-[#3A322D]">
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pt-8 pb-10 grid grid-cols-2 gap-6 text-[15px]">
        <nav aria-label="Guias" className="flex flex-col">
          <strong className="text-sm font-semibold text-[#2A2420]">Guias</strong>
          {AREAS.map((a) => (
            <Link key={a.slug} href={`/${a.slug}`} className="min-h-12 flex items-center no-underline text-[#4A403A] hover:text-[#2A2420]">
              {a.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Institucional" className="flex flex-col">
          <strong className="text-sm font-semibold text-[#2A2420]">{BRAND_NAME}</strong>
          {institucionais.map((p) => (
            <Link key={p} href={`/${p}`} className="min-h-12 flex items-center no-underline text-[#4A403A] hover:text-[#2A2420]">
              {PAGINAS_INSTITUCIONAIS[p].rotulo}
            </Link>
          ))}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="min-h-12 flex items-center no-underline text-[#4A403A] hover:text-[#2A2420]">
            Contato
          </a>
        </nav>
        <p className="col-span-2 m-0 pt-4 border-t border-[#DCCFBD] text-sm text-[#645950] break-words">
          © 2026 {BRAND_NAME} · {SUPPORT_EMAIL}
        </p>
      </div>
    </footer>
  );
}
