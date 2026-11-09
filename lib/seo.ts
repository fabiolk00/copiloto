import type { Metadata } from "next";
import { BRAND_NAME, PREVIEW_PASTA, SUPPORT_EMAIL, precoDaArea, type Area } from "@/lib/guias";

/**
 * Origem canônica do site: SEMPRE o host www. A raiz sem www redireciona (308,
 * configurado na Vercel) para o www, então qualquer canonical, sitemap ou URL
 * de JSON-LD sem www apontaria para um redirect e dividiria sinais (IDX-03/IDX-05).
 *
 * Fixa de propósito, e não derivada de APP_URL: APP_URL serve a pagamentos e
 * e-mails e pode valer outra coisa em preview/dev; o canonical de qualquer
 * ambiente deve sempre apontar para produção (previews nunca viram canônicas).
 */
export const SITE_URL = "https://www.copilotocarreira.com.br";

export function siteOrigin(): string {
  return SITE_URL;
}

/**
 * URL absoluta HTTPS, sem query, hash nem parâmetros de tracking. Convenção:
 * sem barra final, inclusive na raiz, porque é assim que o Next serializa o
 * <link rel="canonical"> da home. Canonical, sitemap e JSON-LD ficam idênticos.
 */
export function canonicalUrl(path: string): string {
  const u = new URL(path, SITE_URL);
  u.search = "";
  u.hash = "";
  if (u.pathname === "/") return u.origin;
  u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

/**
 * Datas de alteração REAL de conteúdo (ISO 8601). Alimentam o <lastmod> do
 * sitemap: só mudam quando o texto da página muda de fato. Data falsa (ex.:
 * `new Date()` a cada build) faz o Google ignorar o campo (IDX-04).
 */
export const ATUALIZADO_EM = {
  home: "2026-11-09",
  guias: "2026-11-09",
  institucional: "2026-11-09",
} as const;

export const SEO_TITLE_HOME = `Guias de carreira em PDF com prompts de IA | ${BRAND_NAME}`;
export const SEO_DESCRIPTION_HOME =
  "Guias digitais em PDF para Financeiro, Dados, Comercial, Marketing, Customer Success e Administrativo, com etapas semanais e prompts de IA prontos.";

/**
 * Title e description por guia (META-01/META-02): únicos, intenção ("guia de X
 * em PDF") no início, descrição de 120 a 160 caracteres com o que de fato está
 * na página (8 semanas em 3 partes, diagnóstico, prompts por área).
 * `resumo` é a linha curta dos cartões da home e de "Outros guias".
 */
export const SEO_GUIAS: Record<string, { title: string; description: string; resumo: string }> = {
  financeiro: {
    title: `Guia de Financeiro em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para profissionais de Financeiro: 8 semanas em 3 partes, diagnóstico de carreira e prompts de IA para conciliações, análises e apresentações.",
    resumo: "Do fechamento do mês à mesa onde as decisões são tomadas.",
  },
  "analise-de-dados": {
    title: `Guia de Análise de Dados em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para quem trabalha com dados: 8 semanas em 3 partes, diagnóstico de carreira e prompts de IA para transformar análises em recomendação.",
    resumo: "Do relatório pedido às pressas à pessoa consultada antes da decisão.",
  },
  comercial: {
    title: `Guia de Comercial em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para quem trabalha com vendas: rotina de 8 semanas, diagnóstico e prompts de IA para vender com mais consistência e crescer na carreira.",
    resumo: "Uma rotina de vendas que não depende de motivação.",
  },
  administrativo: {
    title: `Guia Administrativo em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para a área Administrativa: 8 semanas em 3 partes, diagnóstico de carreira e prompts de IA para e-mails, planilhas, atas e processos.",
    resumo: "Uma rotina que mostra o seu valor e abre o próximo cargo.",
  },
  marketing: {
    title: `Guia de Marketing em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para quem trabalha com marketing: 8 semanas, diagnóstico e prompts de IA para conteúdo, campanhas e relatórios que mostram resultado.",
    resumo: "Do relatório à mesa onde o investimento é decidido.",
  },
  "customer-success": {
    title: `Guia de Customer Success em PDF | ${BRAND_NAME}`,
    description:
      "Guia em PDF para Customer Success: 8 semanas e prompts de IA para onboarding, reuniões de resultado e risco de churn, saindo do modo apagar incêndio.",
    resumo: "Da fila de chamados à conta que a empresa quer proteger.",
  },
};

export function seoGuia(area: Area) {
  const s = SEO_GUIAS[area.slug];
  if (!s) throw new Error(`SEO_GUIAS sem entrada para a área "${area.slug}"`);
  return s;
}

/** Controles de snippet explícitos (META-08): previews ricos permitidos. */
const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
};

/** Rascunhos (páginas institucionais antes da revisão): rastreáveis, mas fora do índice. */
const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = { index: false, follow: true };

type OgImage = { url: string; width: number; height: number; alt: string };

/** Rota gerada por app/opengraph-image.tsx. Explícita porque `openGraph` próprio da página desativa a herança do arquivo. */
export const OG_IMAGE_PADRAO: OgImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${BRAND_NAME}: guias de carreira em PDF com prompts de IA`,
};

/** Imagem OG por guia, gerada por app/[area]/opengraph-image.tsx. */
export const ogImageGuia = (area: Area): OgImage => ({
  url: `/${area.slug}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: `Capa do Guia de ${area.name} em PDF, ${BRAND_NAME}`,
});

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: OgImage;
  noindex?: boolean;
}): Metadata {
  const url = canonicalUrl(input.path);
  const image = input.image ?? OG_IMAGE_PADRAO;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.noindex ? NOINDEX_ROBOTS : INDEXABLE_ROBOTS,
    openGraph: {
      type: "website",
      url,
      title: input.title,
      description: input.description,
      siteName: BRAND_NAME,
      locale: "pt_BR",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images: [image.url] },
  };
}

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: BRAND_NAME,
  url: canonicalUrl("/"),
  // Ativo real do repositório (public/icon-512.png, 512x512).
  logo: `${SITE_URL}/icon-512.png`,
  email: SUPPORT_EMAIL,
  // sameAs omitido até existirem perfis oficiais reais (nada inventado).
});

export const websiteLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: canonicalUrl("/"),
  name: BRAND_NAME,
  inLanguage: "pt-BR",
  publisher: { "@id": `${SITE_URL}/#organization` },
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

/**
 * Produto digital por área (SD-03/SD-04). Preço e moeda são os exibidos na
 * página (SD-02); imagem é a capa real do PDF, a mesma mostrada na galeria.
 * Sem aggregateRating: os depoimentos são prints de mensagens, não avaliações
 * verificáveis com nota.
 */
export const productLd = (area: Area) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: `Guia de ${area.name} em PDF`,
  description: seoGuia(area).description,
  image: [canonicalUrl(`/previews/${PREVIEW_PASTA[area.slug]}-p01.jpg`)],
  url: canonicalUrl(`/${area.slug}`),
  brand: { "@type": "Brand", name: BRAND_NAME },
  offers: {
    "@type": "Offer",
    url: canonicalUrl(`/${area.slug}`),
    price: precoDaArea(area).toFixed(2),
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
  },
});
