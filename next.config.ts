import type { NextConfig } from "next";

/**
 * CSP estática (sem nonce): as páginas de venda são SSG
 * (generateStaticParams em app/[area]/page.tsx) e um CSP com nonce exigiria
 * trocar para renderização dinâmica via proxy.ts para gerar um nonce por
 * requisição — perder a geração estática de uma landing page só por isso
 * não vale a troca. `script-src`/`style-src` precisam de 'unsafe-inline'
 * porque o payload de streaming do React Server Components do App Router
 * usa <script> inline — a defesa real contra XSS aqui é estrutural: nenhum
 * componente usa `dangerouslySetInnerHTML`/`innerHTML` (exceto o JSON-LD de SEO em components/seo/JsonLd.tsx, com dados só de constantes), então
 * tudo que é renderizado passa pelo escape automático do JSX. O CSP abaixo
 * é defesa em profundidade para o resto (framing, embeds, mixed content).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Só tem efeito quando servido por HTTPS (navegadores ignoram em HTTP
  // puro) — correto deixar presente já pensando no deploy real.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // API não tem valor de busca; noindex via cabeçalho cobre o caso de URL linkada de fora.
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
