import Link from "next/link";
import { notFound } from "next/navigation";
import LogoSimbolo from "@/components/LogoSimbolo";
import { BRAND_NAME } from "@/lib/guias";
import { PAGINAS_INSTITUCIONAIS, paginaPublicada, paginaVisivel, type PaginaInstitucional } from "@/lib/institucional";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import Breadcrumb from "./Breadcrumb";

/**
 * Casca comum de Sobre, Privacidade e Termos. Não publicada: 404 em produção;
 * em preview/dev mostra aviso de rascunho (a página também é noindex, ver
 * metadata de cada rota).
 */
export default function PaginaInstitucionalLayout({
  pagina,
  titulo,
  children,
}: {
  pagina: PaginaInstitucional;
  titulo: string;
  children: React.ReactNode;
}) {
  if (!paginaVisivel(pagina)) notFound();
  const rotulo = PAGINAS_INSTITUCIONAIS[pagina].rotulo;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Início", path: "/" }, { name: rotulo, path: `/${pagina}` }])} />
      <header className="border-b border-[#E6DCCD] bg-[#F5EFE6]">
        <div className="max-w-[760px] mx-auto h-14 px-5 md:px-10 flex items-center">
          <Link href="/" className="flex items-center gap-[9px] text-[#2A2420] no-underline">
            <LogoSimbolo size={22} />
            <span className="font-serif text-[17px] tracking-[-0.015em]">{BRAND_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 text-[#2A2420]">
        <div className="max-w-[760px] mx-auto">
          <Breadcrumb atual={rotulo} />
        </div>
        <article className="max-w-[760px] mx-auto px-5 md:px-10 pt-6 pb-14 flex flex-col gap-5 text-base leading-[1.6] text-[#3A322D] [&_h2]:m-0 [&_h2]:pt-3 [&_h2]:font-serif [&_h2]:font-normal [&_h2]:text-[24px] [&_h2]:leading-[1.2] [&_h2]:text-[#2A2420] [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5">
          {!paginaPublicada(pagina) && (
            <p role="note" className="rounded-xl border border-[#C9A25A] bg-[#F7EBD3] px-4 py-3 text-[15px]">
              Rascunho para revisão. Esta página não está publicada e não é indexada; os trechos marcados com TODO
              dependem de dados reais ou de revisão jurídica.
            </p>
          )}
          <h1 className="m-0 font-serif font-normal text-[32px] md:text-[44px] leading-[1.1] tracking-[-.02em] text-[#2A2420]">
            {titulo}
          </h1>
          {children}
        </article>
      </main>
    </>
  );
}
