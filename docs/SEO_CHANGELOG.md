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

## 2026-11-09: ciclo 2 (diretrizes do revisor)

| Mudança | Motivo |
|---|---|
| Preço exibido e `Offer.price` saem de `precoDaArea()`/`formatarPreco()` em `lib/guias.ts`, a mesma fonte do checkout | Página e JSON-LD não podem divergir (SD-02); antes havia "R$ 29,90" escrito à mão em 4 componentes |
| Links cruzados entre páginas institucionais só quando o destino está visível; ambiente lido por chamada | Nenhum link interno para URL 404 em produção |
| `/sobre` sem dados pessoais nem experiência presumida; `/privacidade` com transferência internacional e direitos do titular | E-E-A-T honesto; revisão jurídica pendente |
| Testes sobre o HTML renderizado de cada rota (preço, [n], links) e host canônico com APP_URL ausente | Regressão automática |
| `package-lock.json` sincronizado (commit separado) | `npm ci` falhava |

## 2026-11-09: ciclo 3 (verificação de afirmações e metadados)

| Mudança | Motivo |
|---|---|
| Descriptions de Financeiro, Dados e Administrativo: "diagnóstico de carreira" passa a "diagnóstico"; Dados cita "transformar análise em recomendação" (texto de um prompt visível); Administrativo cita "mapeamento de processos" | Cada afirmação precisa estar no texto visível da própria página; "diagnóstico de carreira" e "análises virem recomendação" não estavam (o `area.sub` não é renderizado) |
| Resumo de Dados: "pedido às pressas" passa a "Do “puxa esse relatório” à pessoa consultada antes da decisão." | "Às pressas" era enfeite, sem lastro no H1 |
| `institucionalMetadata(pagina, …)`: path e noindex derivados de `publicada` | Publicar a página tira o noindex e a põe no sitemap automaticamente |
| `ATUALIZADO_EM.guias` com uma data por área | Editar um guia não mexe no lastmod dos outros |
| `siteOrigin()` removida; layout usa `metadataBase: new URL(SITE_URL)` | Ninguém volta a derivar o host do ambiente |
| Testes: tabela de lastro (description/resumo x texto renderizado) nos 6 guias; metadataBase e title sem template no layout; títulos finais com a marca uma vez; noindex x publicada; lastmod por guia | Regressão automática |

## 2026-11-09: ciclo 5 (reconciliação da produção, sem mudança de código do site)

| Registro | Evidência |
|---|---|
| Produção medida às 17:25Z e 17:43Z: as 9 URLs (3 variações cada, nó `iad1`) servem o conteúdo de 78e048c; campos de SEO e texto visível iguais ao build local | `docs/evidencias/ciclo5/t1_*` |
| Causa reproduzida da falha dos previews: build sem qualquer das 5 variáveis obrigatórias de `lib/env.ts` falha em `/api/internal/reconcile` | `docs/VERCEL_PREVIEW.md`, `docs/evidencias/ciclo5/t3_build_sem_variavel.txt` |
| LCP de laboratório (Lighthouse 13.6.0 mobile) entre 0,76 e 0,96 s, elemento LCP é texto em todas as páginas; nenhuma correção de LCP aplicada | `docs/evidencias/ciclo5/t4_*` |
| Documentos para o dono e o Revalidador | `docs/PRIVACIDADE_FLUXO_DE_DADOS.md`, `docs/PENDENCIAS_DONO.md`, `docs/HANDOFF_REVALIDADOR.md` |

## Pendências humanas (bloqueiam publicação de partes do plano)

1. `/sobre`: confirmar nome, cargo, tempo de experiência, foto, LinkedIn, fontes de pesquisa e quem validou cada área (todos marcados TODO_CONFIRMAR). Publicar trocando `PAGINAS_INSTITUCIONAIS.sobre.publicada` em `lib/institucional.ts`.
2. `/privacidade` e `/termos`: revisão jurídica (controlador e fornecedor, base legal, países e mecanismo da transferência internacional, retenção, cookies, DPO, política de reembolso e arrependimento). Publicar da mesma forma.
3. FAQ "Há garantia ou reembolso?": sem política real definida; não publicada.
4. Número real de prompts por guia (o placeholder foi removido; dá para voltar a citar o número quando houver).
5. Perfis oficiais para `sameAs` da Organization.
6. Após o deploy: inspecionar no GSC as 7 URLs (Testar URL publicada), reenviar o sitemap e solicitar indexação de /marketing e /customer-success.
