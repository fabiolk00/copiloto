import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getAllSlugs } from "@/lib/guias";
import { serializeJsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, canonicalUrl, pageMetadata, productLd, siteOrigin } from "@/lib/seo";
import { AREAS } from "@/lib/guias";

describe("seo", () => {
  it("origem nunca é localhost e é HTTPS (setup usa APP_URL=localhost)", () => {
    expect(siteOrigin()).toBe("https://copilotocarreira.com.br");
  });

  it("canonical é absoluto, sem query/hash/barra final", () => {
    expect(canonicalUrl("/financeiro/?utm_source=x#a")).toBe("https://copilotocarreira.com.br/financeiro");
    expect(canonicalUrl("/")).toBe("https://copilotocarreira.com.br/");
  });

  it("pageMetadata define canonical autorreferente e é indexável", () => {
    const m = pageMetadata({ title: "t", description: "d", path: "/financeiro" });
    expect(m.alternates?.canonical).toBe("https://copilotocarreira.com.br/financeiro");
    expect(JSON.stringify(m.robots)).not.toMatch(/noindex|"index":false/);
  });

  it("sitemap lista home + cada área, só canônicas, sem lastmod falso", () => {
    const urls = sitemap();
    expect(urls.map((u) => u.url)).toEqual([
      "https://copilotocarreira.com.br/",
      ...getAllSlugs().map((s) => `https://copilotocarreira.com.br/${s}`),
    ]);
    expect(urls.every((u) => u.lastModified === undefined)).toBe(true);
  });

  it("robots bloqueia /api/, não bloqueia assets e aponta o sitemap absoluto", () => {
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain("/api/");
    expect(JSON.stringify(r.rules)).not.toContain("_next");
    expect(r.sitemap).toBe("https://copilotocarreira.com.br/sitemap.xml");
  });

  it("Product/Offer reflete preço visível e não usa rating nem FAQPage", () => {
    const ld = productLd(AREAS[0]);
    expect(ld.offers.priceCurrency).toBe("BRL");
    expect(ld.offers.price).toBe("29.90");
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|FAQPage|HowTo/);
  });

  it("breadcrumb tem posições sequenciais e URLs absolutas", () => {
    const b = breadcrumbLd([{ name: "A", path: "/" }, { name: "B", path: "/x" }]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe("https://copilotocarreira.com.br/x");
  });

  it("JSON-LD escapa '<' e continua JSON válido", () => {
    const out = serializeJsonLd({ a: "</script><b>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ a: "</script><b>" });
  });
});
