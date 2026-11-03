import type { Metadata } from "next";
import { BRAND_NAME, PRICE_BRL, type Area } from "@/lib/guias";

/**
 * Origem canônica do site. Lê APP_URL direto de process.env (e não de lib/env)
 * porque lib/env exige segredos de pagamento e não pode ser importada em
 * páginas estáticas apenas para montar metadados. Sem APP_URL (dev/CI) cai no
 * domínio de produção: o canonical nunca deve apontar para localhost.
 */
const PRODUCTION_ORIGIN = "https://copilotocarreira.com.br";

export function siteOrigin(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return PRODUCTION_ORIGIN;
  try {
    const u = new URL(raw);
    // Ambientes locais (harness E2E, dev) nunca viram canonical.
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return PRODUCTION_ORIGIN;
    u.protocol = "https:";
    return u.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

/** URL absoluta HTTPS, sem query, hash nem parâmetros de tracking. Convenção: sem barra final (padrão do Next). */
export function canonicalUrl(path: string): string {
  const u = new URL(path, siteOrigin());
  u.search = "";
  u.hash = "";
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export const SEO_TITLE_HOME = `${BRAND_NAME} — guias de carreira em PDF`;

/** Controles de snippet explícitos (META-08): previews ricos permitidos. */
const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
};

/** Rota gerada por app/opengraph-image.tsx. Explícita porque `openGraph` próprio da página desativa a herança do arquivo. */
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND_NAME} — guias de carreira em PDF` };

export function pageMetadata(input: { title: string; description: string; path: string }): Metadata {
  const url = canonicalUrl(input.path);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: INDEXABLE_ROBOTS,
    openGraph: {
      type: "website",
      url,
      title: input.title,
      description: input.description,
      siteName: BRAND_NAME,
      locale: "pt_BR",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images: [OG_IMAGE.url] },
  };
}

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteOrigin()}/#organization`,
  name: BRAND_NAME,
  url: siteOrigin(),
  // logo e sameAs: omitidos até existirem ativos/perfis oficiais reais (nada inventado).
});

export const websiteLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteOrigin()}/#website`,
  url: siteOrigin(),
  name: BRAND_NAME,
  inLanguage: "pt-BR",
  publisher: { "@id": `${siteOrigin()}/#organization` },
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: canonicalUrl(c.path),
  })),
});

/** Produto digital por área. Preço e moeda são os exibidos na página (SD-02); sem rating, sem imagem inventada. */
export const productLd = (area: Area) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: `Guia de ${area.name} — ${BRAND_NAME}`,
  description: area.sub,
  url: canonicalUrl(`/${area.slug}`),
  brand: { "@type": "Brand", name: BRAND_NAME },
  offers: {
    "@type": "Offer",
    url: canonicalUrl(`/${area.slug}`),
    price: PRICE_BRL.toFixed(2),
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
  },
});
