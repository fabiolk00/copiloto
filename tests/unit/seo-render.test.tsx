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
