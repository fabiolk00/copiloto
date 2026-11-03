import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

/**
 * robots.txt controla rastreamento, não indexação. /api/ não tem valor de busca
 * (e responde com X-Robots-Tag: noindex, ver next.config.ts). /_next/static/
 * NÃO é bloqueado: o Googlebot precisa de CSS/JS para renderizar.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
