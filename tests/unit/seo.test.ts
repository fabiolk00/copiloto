import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { AREAS, getAllSlugs } from "@/lib/guias";
import { serializeJsonLd } from "@/components/seo/JsonLd";
import {
  SEO_DESCRIPTION_HOME,
  SEO_GUIAS,
  SEO_TITLE_HOME,
  breadcrumbLd,
  canonicalUrl,
  organizationLd,
  pageMetadata,
  ogImageGuia,
  productLd,
  SITE_URL,
  ATUALIZADO_EM,
  institucionalMetadata,
} from "@/lib/seo";
import { PAGINAS_INSTITUCIONAIS } from "@/lib/institucional";

// next/font só existe dentro do compilador do Next; aqui interessa só o objeto `metadata` do layout.
vi.mock("next/font/google", () => {
  const fonte = () => ({ variable: "", className: "", style: {} });
  return { Newsreader: fonte, Instrument_Sans: fonte };
});

const WWW = "https://www.copilotocarreira.com.br";

describe("seo", () => {
  it("origem canônica é o host www, HTTPS, mesmo com APP_URL=localhost (IDX-03/IDX-05)", () => {
    expect(SITE_URL).toBe(WWW);
  });

  it("host canônico continua www com APP_URL ausente ou apontando para outro host", async () => {
    const original = process.env.APP_URL;
    try {
      for (const valor of [undefined, "https://copilotocarreira.com.br", "https://preview-x.vercel.app"]) {
        if (valor === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = valor;
        vi.resetModules();
        const seo = await import("@/lib/seo");
        expect(seo.SITE_URL).toBe(WWW);
        expect(seo.canonicalUrl("/marketing")).toBe(`${WWW}/marketing`);
        expect(seo.pageMetadata({ title: "t", description: "d", path: "/" }).alternates?.canonical).toBe(WWW);
        expect(seo.organizationLd().url).toBe(WWW);
      }
    } finally {
      if (original === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = original;
      vi.resetModules();
    }
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

  it("lastmod é por guia: cada área tem a própria data, e o sitemap usa a da área", () => {
    expect(Object.keys(ATUALIZADO_EM.guias).sort()).toEqual([...getAllSlugs()].sort());
    const antes = new Map(sitemap().map((u) => [u.url, u.lastModified]));
    for (const s of getAllSlugs()) expect(antes.get(`${WWW}/${s}`)).toBe(ATUALIZADO_EM.guias[s]);
    // Editar um guia só muda o lastmod dele.
    const original = ATUALIZADO_EM.guias.marketing;
    try {
      ATUALIZADO_EM.guias.marketing = "2099-01-01";
      const depois = new Map(sitemap().map((u) => [u.url, u.lastModified]));
      for (const [url, data] of depois) expect(data, url).toBe(url === `${WWW}/marketing` ? "2099-01-01" : antes.get(url));
    } finally {
      ATUALIZADO_EM.guias.marketing = original;
    }
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


});

describe("metadados resolvidos pelo Next", () => {
  it("layout: metadataBase no host www e title sem template (sem marca duplicada)", async () => {
    const { metadata } = await import("@/app/layout");
    expect(new URL(String(metadata.metadataBase)).href).toBe(`${WWW}/`);
    expect(typeof metadata.title).toBe("string");
  });

  it("og:image e twitter:image relativos resolvem para o host www", () => {
    const m = pageMetadata({ title: "t", description: "d", path: "/marketing", image: ogImageGuia(AREAS[0]) });
    const og = (m.openGraph?.images as { url: string }[])[0].url;
    const tw = (m.twitter?.images as string[])[0];
    for (const rel of [og, tw]) expect(new URL(rel, `${WWW}/`).href.startsWith(`${WWW}/`)).toBe(true);
  });

  it("títulos finais de todas as rotas: marca uma vez só, até 65 caracteres e únicos", async () => {
    const { metadata: layout } = await import("@/app/layout");
    // Sem template no layout, o <title> renderizado é exatamente o title da página.
    expect(layout.title).not.toHaveProperty("template");
    const { metadata: home } = await import("@/app/page");
    const { generateMetadata } = await import("@/app/[area]/page");
    const guias = await Promise.all(AREAS.map((a) => generateMetadata({ params: Promise.resolve({ area: a.slug }) })));
    const inst = await Promise.all(
      ["sobre", "privacidade", "termos"].map(async (p) => (await import(`@/app/${p}/page`)).metadata as { title: string }),
    );
    const titulos = [home, ...guias, ...inst].map((m) => String(m.title));
    expect(new Set(titulos).size).toBe(titulos.length);
    for (const t of titulos) {
      expect(t.split("Copiloto Carreira").length - 1, t).toBe(1);
      expect(t.length, t).toBeLessThanOrEqual(65);
    }
  });
});

describe("indexação das páginas institucionais acompanha a publicação", () => {
  const paginas = Object.keys(PAGINAS_INSTITUCIONAIS) as (keyof typeof PAGINAS_INSTITUCIONAIS)[];

  it.each(paginas)("/%s: noindex enquanto rascunho, indexável quando publicada (sem valor manual)", (p) => {
    const original = PAGINAS_INSTITUCIONAIS[p].publicada;
    try {
      for (const publicada of [false, true]) {
        PAGINAS_INSTITUCIONAIS[p].publicada = publicada;
        const m = institucionalMetadata(p, { title: "t", description: "d" });
        expect(m.alternates?.canonical).toBe(`${WWW}/${p}`);
        expect(JSON.stringify(m.robots).includes('"index":false')).toBe(!publicada);
        expect(sitemap().some((u) => u.url === `${WWW}/${p}`)).toBe(publicada);
      }
    } finally {
      PAGINAS_INSTITUCIONAIS[p].publicada = original;
    }
  });

  it.each(paginas)("/%s: a rota usa institucionalMetadata (robots coerente com a flag atual)", async (p) => {
    const { metadata } = await import(`@/app/${p}/page`);
    expect(JSON.stringify(metadata.robots).includes('"index":false')).toBe(!PAGINAS_INSTITUCIONAIS[p].publicada);
    expect(metadata.alternates.canonical).toBe(`${WWW}/${p}`);
  });
});
