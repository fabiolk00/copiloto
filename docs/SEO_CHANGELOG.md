# Log de mudanças SEO

Registro para atribuir causa a variações no Search Console (OPS-05).

## 2026-11-09: harness de SEO, fases A a D (código)

| Mudança | Hipótese | Métrica para acompanhar |
|---|---|---|
| Host canônico fixo em `https://www.copilotocarreira.com.br` (canonical, sitemap, JSON-LD, og:url). Antes, o fallback era o host sem www, que redireciona. | Sinais consolidados numa única URL por página | GSC: canônico escolhido pelo Google = declarado |
| Title e description únicos por página (Parte B, 4.1) | CTR maior, intenção "guia de X em PDF" | GSC: impressões e CTR por página |
| FAQ em `<details>`: respostas no HTML do servidor (antes só após clique) | Passagens elegíveis para snippet e para AI Overviews | GSC: consultas de pergunta |
| Placeholder "[n]" removido (Marketing, CS e demais) | Qualidade percebida | n/a |
| Home reescrita: H1 com intenção, 6 cartões, como funciona, incluso, FAQ e cerca de 440 palavras | Home deixa de ser página rasa | GSC: consultas da home |
| Breadcrumb visível, "Outros guias" e rodapé global com links para os 6 guias | Rastreamento e distribuição de links internos | GSC: indexação das 6 páginas de guia |
| Sitemap com `lastmod` real (ATUALIZADO_EM em `lib/seo.ts`) | Recrawl após mudança real | GSC: Sitemaps |
| JSON-LD: Organization com logo e e-mail, Product com imagem da capa e nome "Guia de X em PDF", BreadcrumbList com "Início" | Elegibilidade a resultados de produto | Rich Results Test, GSC: Fragmentos de produtos |
| OG 1200x630 por guia (`app/[area]/opengraph-image.tsx`) | Compartilhamento com prévia específica | n/a |
| `images.deviceSizes` sem 2048/3840; `sizes` realistas na galeria e nos depoimentos; miniatura do hero mobile sem lazy | Menos bytes no mobile | CrUX: LCP p75 |
| Alvos de toque de 48 px (rodapé, breadcrumb, menu, copiar prompt) | MOB-01 | Lighthouse a11y |
| `/sobre`, `/privacidade`, `/termos` criados como rascunho: 404 em produção, `noindex` e aviso em preview | Publicar só após revisão (CON-04) | n/a |

## Pendências humanas (bloqueiam publicação de partes do plano)

1. `/sobre`: confirmar nome, cargo, experiência, foto, LinkedIn e o processo real de revisão dos guias. Publicar trocando `PAGINAS_INSTITUCIONAIS.sobre.publicada` em `lib/institucional.ts`.
2. `/privacidade` e `/termos`: revisão jurídica (controlador e fornecedor, base legal, retenção, cookies, política de reembolso e arrependimento). Publicar da mesma forma.
3. FAQ "Há garantia ou reembolso?": sem política real definida; não publicada.
4. Número real de prompts por guia (o placeholder foi removido; dá para voltar a citar o número quando houver).
5. Perfis oficiais para `sameAs` da Organization.
6. Após o deploy: inspecionar no GSC as 7 URLs (Testar URL publicada), reenviar o sitemap e solicitar indexação de /marketing e /customer-success.
