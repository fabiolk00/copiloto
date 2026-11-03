import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/guias";
import { canonicalUrl } from "@/lib/seo";

/**
 * Só URLs canônicas, 200 e indexáveis. `lastModified` omitido de propósito:
 * não há data real de alteração de conteúdo, e `new Date()` seria lastmod falso
 * (o Google passa a ignorar o campo). Reintroduzir quando houver data de edição real.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [canonicalUrl("/"), ...getAllSlugs().map((s) => canonicalUrl(`/${s}`))].map((url) => ({ url }));
}
