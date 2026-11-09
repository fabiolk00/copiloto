/**
 * Páginas institucionais (CON-04: Sobre, Privacidade, Termos).
 *
 * Regra do projeto: textos legais só vão ao ar depois da revisão jurídica do
 * dono, e a página Sobre só com dados do autor confirmados. Enquanto
 * `publicada` for false:
 *  - em produção (VERCEL_ENV=production) a rota responde 404;
 *  - em preview/dev ela renderiza com aviso de rascunho e `noindex`, para revisão;
 *  - não entra no sitemap nem é linkada no rodapé de produção.
 * Publicar = trocar `publicada` para true e atualizar ATUALIZADO_EM.institucional.
 */
export type PaginaInstitucional = "sobre" | "privacidade" | "termos";

export const PAGINAS_INSTITUCIONAIS: Record<PaginaInstitucional, { rotulo: string; publicada: boolean }> = {
  sobre: { rotulo: "Sobre", publicada: false },
  privacidade: { rotulo: "Privacidade", publicada: false },
  termos: { rotulo: "Termos", publicada: false },
};

/** Lido a cada chamada (não no carregamento do módulo) para ser testável. */
function emProducao(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function paginaPublicada(p: PaginaInstitucional): boolean {
  return PAGINAS_INSTITUCIONAIS[p]?.publicada === true;
}

/** Visível = publicada, ou rascunho fora de produção (preview/dev, para revisão). */
export function paginaVisivel(p: PaginaInstitucional): boolean {
  return paginaPublicada(p) || !emProducao();
}

export function paginasVisiveis(): PaginaInstitucional[] {
  return (Object.keys(PAGINAS_INSTITUCIONAIS) as PaginaInstitucional[]).filter(paginaVisivel);
}
