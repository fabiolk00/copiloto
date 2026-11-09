import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Único hook do Next usado nas páginas de venda (PixCheckout); fora do Next ele lança.
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

import Home from "@/app/page";
import VendaPage from "@/app/[area]/page";
import Footer from "@/components/site/Footer";
import FaqSection from "@/components/venda/FaqSection";
import { AREAS, COMMON_FAQ } from "@/lib/guias";
import { SEO_GUIAS } from "@/lib/seo";
import { PAGINAS_INSTITUCIONAIS, type PaginaInstitucional } from "@/lib/institucional";
import sitemap from "@/app/sitemap";

/** HTML que o servidor entrega para cada rota indexável (home + 6 guias), com o rodapé do layout. */
async function htmlDaRota(slug?: string): Promise<string> {
  const pagina = slug ? await VendaPage({ params: Promise.resolve({ area: slug }) }) : Home();
  return renderToStaticMarkup(
    <>
      {pagina}
      <Footer />
    </>,
  );
}

const ROTAS: (string | undefined)[] = [undefined, ...AREAS.map((a) => a.slug)];
const nomeRota = (s?: string) => (s ? `/${s}` : "/");

/** Texto visível aproximado: sem tags, sem <script> (JSON-LD), entidades básicas resolvidas. */
const textoVisivel = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&");

const ambienteOriginal = process.env.VERCEL_ENV;
afterEach(() => {
  if (ambienteOriginal === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ambienteOriginal;
});

describe("SEO no HTML renderizado", () => {
  it.each(AREAS.map((a) => [a.slug, a] as const))(
    "FAQ de %s entrega todas as respostas no HTML, com o acordeão fechado (IDX-07)",
    (_slug, area) => {
      const html = renderToStaticMarkup(<FaqSection area={area} />);
      expect(html).toContain("<details");
      expect(html).not.toMatch(/<details[^>]*\sopen/);
      for (const [pergunta, resposta] of [area.faq1, ...COMMON_FAQ]) {
        expect(html).toContain(pergunta);
        expect(html).toContain(resposta);
      }
    },
  );

  it.each(ROTAS.map((s) => [nomeRota(s), s] as const))("%s não exibe o placeholder [n]", async (_rota, slug) => {
    expect(textoVisivel(await htmlDaRota(slug))).not.toContain("[n]");
  });

  it.each(AREAS.map((a) => [a.slug] as const))(
    "/%s: preço do Offer no JSON-LD é o mesmo exibido na página (SD-02)",
    async (slug) => {
      const html = await htmlDaRota(slug);
      const blocos = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
        JSON.parse(m[1]),
      );
      const produto = blocos.flat().find((n) => n["@type"] === "Product");
      expect(produto).toBeDefined();
      const precoLd = Number(produto.offers.price);

      const exibidos = [...textoVisivel(html).matchAll(/R\$\s*(\d+),(\d{2})/g)].map((m) => Number(`${m[1]}.${m[2]}`));
      expect(exibidos.length).toBeGreaterThan(0);
      expect(new Set(exibidos)).toEqual(new Set([precoLd]));
    },
  );

  it("em produção, nenhuma rota indexável linka página institucional não publicada (CON-04/IDX-06)", async () => {
    process.env.VERCEL_ENV = "production";
    const naoPublicadas = (Object.keys(PAGINAS_INSTITUCIONAIS) as PaginaInstitucional[]).filter(
      (p) => !PAGINAS_INSTITUCIONAIS[p].publicada,
    );
    for (const slug of ROTAS) {
      const html = await htmlDaRota(slug);
      for (const p of naoPublicadas) expect(html, `${nomeRota(slug)} linka /${p}`).not.toContain(`href="/${p}"`);
    }
    const locs = sitemap().map((u) => u.url);
    for (const p of naoPublicadas) expect(locs.some((u) => u.endsWith(`/${p}`))).toBe(false);
  });

  it("fora de produção (preview/dev) o rodapé mostra os rascunhos para revisão", () => {
    process.env.VERCEL_ENV = "preview";
    const html = renderToStaticMarkup(<Footer />);
    for (const p of Object.keys(PAGINAS_INSTITUCIONAIS)) expect(html).toContain(`href="/${p}"`);
  });
});

/**
 * Cada afirmação da meta description e do resumo do cartão precisa de lastro
 * no texto visível da própria página (a description não pode prometer o que a
 * página não entrega). Chave: trecho da description/resumo; valor: evidência
 * que tem de aparecer no HTML renderizado do guia.
 */
const LASTRO: Record<string, Record<string, string>> = {
  financeiro: {
    "8 semanas": "Oito semanas",
    "3 partes": "Parte III",
    diagnóstico: "Diagnóstico de onde você está hoje",
    "conciliações, análises e apresentações": "conciliações, análises e apresentações",
    "Do fechamento do mês à mesa onde as decisões são tomadas.": "Do fechamento do mês para a mesa onde as decisões são tomadas.",
  },
  "analise-de-dados": {
    "8 semanas": "Oito semanas",
    "3 partes": "Parte III",
    diagnóstico: "Diagnóstico de onde você está hoje",
    "transformar análise em recomendação": "Transformar análise em recomendação",
    "Do “puxa esse relatório” à pessoa consultada antes da decisão.": "para a pessoa consultada antes da decisão",
    "“puxa esse relatório”": "puxa esse relatório",
  },
  comercial: {
    "rotina de 8 semanas": "Oito semanas",
    diagnóstico: "Diagnóstico da sua rotina comercial",
    "vender com mais consistência": "prova de consistência",
    "Uma rotina de vendas que não depende de motivação.": "Uma rotina comercial que não depende de estar motivado no dia.",
  },
  administrativo: {
    "8 semanas": "Oito semanas",
    "3 partes": "Parte III",
    diagnóstico: "Diagnóstico de onde você está hoje",
    "e-mails, planilhas, atas e mapeamento de processos": "e-mails, planilhas, atas e mapeamento de processos",
    "Uma rotina que mostra o seu valor e abre o próximo cargo.": "mostra o seu valor e abre o próximo cargo",
  },
  marketing: {
    "8 semanas": "Oito semanas",
    diagnóstico: "Diagnóstico de onde você está hoje",
    "conteúdo, campanhas e relatórios": "conteúdo, campanhas e relatórios de resultado",
    "Do relatório à mesa onde o investimento é decidido.": "para a mesa onde o investimento é decidido",
  },
  "customer-success": {
    "8 semanas": "Oito semanas",
    "onboarding, reuniões de resultado e risco de churn": "onboarding, reuniões de resultado e risco de churn",
    "apagar incêndio": "apagar incêndio",
    "Da fila de chamados à conta que a empresa quer proteger.": "Da fila de chamados para a conta que a empresa quer proteger.",
  },
};

describe("descriptions e resumos têm lastro no conteúdo visível", () => {
  it.each(AREAS.map((a) => [a.slug] as const))("/%s", async (slug) => {
    const lastro = LASTRO[slug];
    expect(lastro, `sem tabela de lastro para ${slug}`).toBeDefined();
    const { description, resumo } = SEO_GUIAS[slug];
    // Toda chave precisa ser texto real da description ou do resumo (a tabela não pode envelhecer).
    for (const trecho of Object.keys(lastro)) expect(`${description} ${resumo}`, trecho).toContain(trecho);
    // E toda evidência precisa estar no texto visível da própria página, não em outro guia.
    const html = await htmlDaRota(slug);
    const semOutrosGuias = html.replace(/<section id="outros-guias"[\s\S]*?<\/section>/, " ");
    const visivel = textoVisivel(semOutrosGuias).replace(/\s+/g, " ");
    for (const [trecho, evidencia] of Object.entries(lastro)) expect(visivel, `"${trecho}" sem lastro`).toContain(evidencia);
  });
});

describe("[n] no código-fonte", () => {
  // Toda pasta que contém texto de página. tests/ e docs/ ficam fora porque descrevem o placeholder.
  const IGNORAR = new Set(["node_modules", ".next", ".git", "tests", "docs", "coverage", "test-results"]);
  const TEXTO = /\.(tsx?|jsx?|mdx?|json|html|txt|ya?ml)$/;
  const varrer = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (IGNORAR.has(e.name)) return [];
      const p = path.join(dir, e.name);
      return e.isDirectory() ? varrer(p) : TEXTO.test(e.name) ? [p] : [];
    });

  it("nenhum arquivo de texto do repositório (fora tests/docs) contém [n]", () => {
    const arquivos = varrer(process.cwd()).filter((f) => !f.endsWith("package-lock.json"));
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos.filter((f) => readFileSync(f, "utf8").includes("[n]"))).toEqual([]);
  });
});
