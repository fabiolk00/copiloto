import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/guias";
import { PAGINAS_INSTITUCIONAIS, paginaPublicada, type PaginaInstitucional } from "@/lib/institucional";
import { ATUALIZADO_EM, canonicalUrl } from "@/lib/seo";

/**
 * Só URLs canônicas (host www), 200 e indexáveis (IDX-04). `lastModified` vem
 * de ATUALIZADO_EM, que só muda quando o conteúdo muda de fato. Páginas
 * institucionais entram apenas depois de publicadas (antes disso dão 404 em
 * produção e são noindex em preview).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const institucionais = (Object.keys(PAGINAS_INSTITUCIONAIS) as PaginaInstitucional[]).filter(paginaPublicada);
  return [
    { url: canonicalUrl("/"), lastModified: ATUALIZADO_EM.home },
    ...getAllSlugs().map((s) => ({ url: canonicalUrl(`/${s}`), lastModified: ATUALIZADO_EM.guias })),
    ...institucionais.map((p) => ({ url: canonicalUrl(`/${p}`), lastModified: ATUALIZADO_EM.institucional })),
  ];
}
