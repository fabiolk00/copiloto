import Link from "next/link";
import { AREAS } from "@/lib/guias";
import { SEO_GUIAS } from "@/lib/seo";

/**
 * Cartões compactos dos guias (nome + uma linha), com <a href> rastreável
 * (IDX-08) e âncora descritiva (CON-06). Lista vertical no mobile, 2 colunas
 * a partir de 768 px. `excluir` remove o guia atual em "Outros guias".
 */
export default function GuiasCards({ excluir }: { excluir?: string }) {
  return (
    <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {AREAS.filter((a) => a.slug !== excluir).map((a) => (
        <li key={a.slug}>
          <Link
            href={`/${a.slug}`}
            className="min-h-12 h-full px-4 py-3.5 rounded-xl border border-[#E2D8C9] bg-[#FBF8F2] flex items-start gap-3 no-underline text-[#2A2420] hover:border-[#C9BBA8]"
          >
            <span aria-hidden="true" className="flex-none mt-2 w-2 h-2 rounded-full" style={{ background: a.c }} />
            <span className="flex flex-col gap-0.5 text-left">
              <strong className="text-base font-semibold">Guia de {a.name}</strong>
              <span className="text-[15px] leading-[1.4] text-[#645950]">{SEO_GUIAS[a.slug].resumo}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
