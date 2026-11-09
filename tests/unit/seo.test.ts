import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { AREAS, COMMON_FAQ, getAllSlugs } from "@/lib/guias";
import { serializeJsonLd } from "@/components/seo/JsonLd";
import FaqSection from "@/components/venda/FaqSection";
import {
  SEO_DESCRIPTION_HOME,
  SEO_GUIAS,
  SEO_TITLE_HOME,
  breadcrumbLd,
  canonicalUrl,
  organizationLd,
  pageMetadata,
  productLd,
  siteOrigin,
} from "@/lib/seo";
import { PAGINAS_INSTITUCIONAIS } from "@/lib/institucional";

const WWW = "https://www.copilotocarreira.com.br";

describe("seo", () => {
  it("origem canônica é o host www, HTTPS, mesmo com APP_URL=localhost (IDX-03/IDX-05)", () => {
    expect(siteOrigin()).toBe(WWW);
  });

  it("canonical é absoluto, sem query/hash/barra final", () => {
    expect(canonicalUrl("/financeiro/?utm_source=x#a")).toBe(`${WWW}/financeiro`);
    expect(canonicalUrl("/")).toBe(WWW);
  });

  it("pageMetadata define canonical autorreferente e é indexável; noindex só quando pedido", () => {
    const m = pageMetadata({ title: "t", description: "d", path: "/financeiro" });
    expect(m.alternates?.canonical).toBe(`${WWW}/financeiro`);
    expect(JSON.stringify(m.robots)).not.toMatch(/noindex|"index":false/);
    const rascunho = pageMetadata({ title: "t", description: "d", path: "/termos", noindex: true });
    expect(JSON.stringify(rascunho.robots)).toMatch(/"index":false/);
  });

  it("titles e descriptions são únicos e dentro dos limites (META-01/META-02)", () => {
    const titles = [SEO_TITLE_HOME, ...AREAS.map((a) => SEO_GUIAS[a.slug].title)];
    const descs = [SEO_DESCRIPTION_HOME, ...AREAS.map((a) => SEO_GUIAS[a.slug].description)];
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
    titles.forEach((t) => expect(t.length).toBeLessThanOrEqual(65));
    descs.forEach((d) => {
      expect(d.length).toBeGreaterThanOrEqual(120);
      expect(d.length).toBeLessThanOrEqual(160);
    });
    AREAS.forEach((a) => expect(SEO_GUIAS[a.slug].title.startsWith("Guia")).toBe(true));
  });

  it("sitemap lista home + 6 guias no host www, com lastmod ISO real e sem rascunhos", () => {
    const urls = sitemap();
    const publicadas = Object.entries(PAGINAS_INSTITUCIONAIS).filter(([, p]) => p.publicada).map(([k]) => `${WWW}/${k}`);
    expect(urls.map((u) => u.url)).toEqual([WWW, ...getAllSlugs().map((s) => `${WWW}/${s}`), ...publicadas]);
    expect(getAllSlugs()).toEqual(expect.arrayContaining(["marketing", "customer-success"]));
    urls.forEach((u) => expect(String(u.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("robots bloqueia /api/, não bloqueia assets e aponta o sitemap absoluto www", () => {
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain("/api/");
    expect(JSON.stringify(r.rules)).not.toContain("_next");
    expect(r.sitemap).toBe(`${WWW}/sitemap.xml`);
  });

  it("Product/Offer reflete preço visível, tem imagem real e não usa rating nem FAQPage", () => {
    for (const area of AREAS) {
      const ld = productLd(area);
      expect(ld.offers.priceCurrency).toBe("BRL");
      expect(ld.offers.price).toBe("29.90");
      expect(ld.url).toBe(`${WWW}/${area.slug}`);
      const img = ld.image[0].replace(WWW, "");
      expect(readFileSync(path.join(process.cwd(), "public", img)).length).toBeGreaterThan(0);
      expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|FAQPage|HowTo/);
    }
  });

  it("Organization usa logo real do repositório", () => {
    const org = organizationLd();
    expect(readFileSync(path.join(process.cwd(), "public", org.logo.replace(WWW, ""))).length).toBeGreaterThan(0);
  });

  it("breadcrumb tem posições sequenciais e URLs absolutas", () => {
    const b = breadcrumbLd([{ name: "A", path: "/" }, { name: "B", path: "/x" }]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe(`${WWW}/x`);
  });

  it("JSON-LD escapa '<' e continua JSON válido", () => {
    const out = serializeJsonLd({ a: "</script><b>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ a: "</script><b>" });
  });

  it("FAQ entrega as respostas no HTML do servidor, mesmo fechado (IDX-07)", () => {
    const html = renderToStaticMarkup(FaqSection({ area: AREAS[0] }));
    expect(html).toContain("<details");
    for (const [, resposta] of [AREAS[0].faq1, ...COMMON_FAQ]) expect(html).toContain(resposta);
  });

  it("nenhum placeholder [n] no código das páginas", () => {
    const varrer = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? varrer(path.join(dir, e.name)) : /\.(tsx?|mdx?)$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const arquivos = ["app", "components", "lib"].flatMap((d) => varrer(path.join(process.cwd(), d)));
    const comPlaceholder = arquivos.filter((f) => readFileSync(f, "utf8").includes("[n]"));
    expect(comPlaceholder).toEqual([]);
  });
});
