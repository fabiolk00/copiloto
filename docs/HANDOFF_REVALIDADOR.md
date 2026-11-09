# Handoff para o Revalidador independente (ciclo 5)

Este pacote traz a verdade esperada derivada do CÓDIGO-FONTE do commit `78e048c1950ce9f9cf3675366d3cfad13ee8de68` (main), não do HTML renderizado. O Revalidador mede a produção e compara com esta tabela. Este documento não contém conclusões de aprovação.

Índice dos itens exigidos pela T7:

| Item exigido | Onde está |
|---|---|
| Tabela por URL (title, description, canonical, H1, preço, JSON-LD, og:image) e valores de cabeçalho | seção 2 |
| Frases-âncora do FAQ e resumos dos cartões | seções 3 e 3.1 |
| Itens do checklist aplicáveis e lista de N/A com justificativa (OPS-04, IDX-09, IDX-10, I18N-01, LOC-01, VID-01, IMG-01, SD-04 LocalBusiness) | seção 4 |
| Definições de CON-05 e CON-06 | seção 4.1 |
| Exceção da heurística "primeira imagem lazy" na home, com evidência de LCP | seção 5 |
| Comandos exatos do Revalidador (seo_audit.py, check_http.sh, paridade, grep, teste negativo) | seção 6 |

## 1. Condição de teste

- Alvo: produção, `https://www.copilotocarreira.com.br` (host canônico com www; a raiz sem www responde 308 para o www).
- Rede sem bloqueio. Use `curl` ou navegador e registre `date`, `age`, `x-vercel-cache`, `x-vercel-id` e `etag` de cada resposta, para que a medição seja verificável.
- Divergência do ciclo anterior (EM ABERTO): uma leitura independente às ~17:17Z de 2026-11-09 viu conteúdo antigo. No ciclo 5, a T1 mediu conteúdo novo nas 9 URLs em 17:25Z e 17:43Z, mas todas as respostas vieram do nó `iad1`. Não se sabe a causa da leitura antiga (cache da ferramenta de leitura, outra região da CDN, ou outra). Registre o prefixo de `x-vercel-id` de cada resposta; se possível, meça de mais de uma região.
- Preview: só se existir um preview funcional (hoje os previews falham no build; ver `docs/VERCEL_PREVIEW.md`).
- Páginas não publicadas: `/sobre`, `/privacidade`, `/termos` devem responder 404 em produção. Não fazem parte do escopo indexável.

## 2. Verdade esperada por URL

Fontes: `lib/seo.ts` (`SEO_TITLE_HOME`, `SEO_DESCRIPTION_HOME`, `SEO_GUIAS`, `canonicalUrl`, `productLd`, `breadcrumbLd`), `lib/guias.ts` (`h1`, `PRICE_BRL`, `formatarPreco`), `app/page.tsx`, `app/[area]/opengraph-image.tsx`, `app/opengraph-image.tsx`.

| URL | title | canonical | H1 | Preço visível / `Offer.price` | JSON-LD | og:image |
|---|---|---|---|---|---|---|
| `/` | Guias de carreira em PDF com prompts de IA \| Copiloto Carreira | `https://www.copilotocarreira.com.br` | Guias de carreira em PDF com prompts de IA | R$ 29,90 / n/a | Organization, WebSite | `https://www.copilotocarreira.com.br/opengraph-image` |
| `/financeiro` | Guia de Financeiro em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/financeiro` | Do fechamento do mês para a mesa onde as decisões são tomadas. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/financeiro/opengraph-image` |
| `/analise-de-dados` | Guia de Análise de Dados em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/analise-de-dados` | Do “puxa esse relatório pra mim” para a pessoa consultada antes da decisão. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/analise-de-dados/opengraph-image` |
| `/comercial` | Guia de Comercial em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/comercial` | Uma rotina comercial que não depende de estar motivado no dia. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/comercial/opengraph-image` |
| `/marketing` | Guia de Marketing em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/marketing` | Do post e do relatório para a mesa onde o investimento é decidido. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/marketing/opengraph-image` |
| `/customer-success` | Guia de Customer Success em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/customer-success` | Da fila de chamados para a conta que a empresa quer proteger. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/customer-success/opengraph-image` |
| `/administrativo` | Guia Administrativo em PDF \| Copiloto Carreira | `https://www.copilotocarreira.com.br/administrativo` | Uma rotina administrativa que mostra o seu valor e abre o próximo cargo. | R$ 29,90 / `29.90` BRL | Product, BreadcrumbList | `https://www.copilotocarreira.com.br/administrativo/opengraph-image` |

og:image: no HTML o valor é a URL absoluta com www (coluna acima, igual em `og:image` e `twitter:image`). Cada uma deve responder 200 com `content-type: image/png` (1200x630, `app/opengraph-image.tsx` e `app/[area]/opengraph-image.tsx`). Medido no ciclo 5 (2026-11-09 17:52:55Z): as 7 responderam `200 image/png`, de 38568 B a 64704 B.

Tags por página (valores gerados por `pageMetadata` em `lib/seo.ts`, conferidos no HTML de produção):

| Tag | Valor esperado |
|---|---|
| `<html lang>` | `pt-BR` |
| `<meta name="robots">` | `index, follow` |
| `<meta name="googlebot">` | `index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1` |
| `twitter:card` | `summary_large_image` |
| `twitter:title`, `twitter:description` | iguais ao title e à description da página |
| `twitter:image` | igual ao og:image da página |

Atenção: `max-snippet:-1` e `max-image-preview:large` estão na meta `googlebot`, não na `robots`. Um teste que procure esses valores só em `robots` vai falhar sem que exista problema. Nenhuma página pode ter `noindex`.

Quantidade de H2: home 7; cada um dos 6 guias 8 (medido no HTML de produção e no build local de 78e048c, `docs/evidencias/ciclo5/t1_*.jsonl`, campo `h2_count`).

Meta descriptions (texto exato em `lib/seo.ts`):

| URL | description |
|---|---|
| `/` | Guias digitais em PDF para Financeiro, Dados, Comercial, Marketing, Customer Success e Administrativo, com etapas semanais e prompts de IA prontos. |
| `/financeiro` | Guia em PDF para profissionais de Financeiro: 8 semanas em 3 partes, diagnóstico e prompts de IA para conciliações, análises e apresentações. |
| `/analise-de-dados` | Guia em PDF para quem trabalha com dados: 8 semanas em 3 partes, diagnóstico e prompts de IA para transformar análise em recomendação. |
| `/comercial` | Guia em PDF para quem trabalha com vendas: rotina de 8 semanas, diagnóstico e prompts de IA para vender com mais consistência e crescer na carreira. |
| `/marketing` | Guia em PDF para quem trabalha com marketing: 8 semanas, diagnóstico e prompts de IA para conteúdo, campanhas e relatórios que mostram resultado. |
| `/customer-success` | Guia em PDF para Customer Success: 8 semanas e prompts de IA para onboarding, reuniões de resultado e risco de churn, saindo do modo apagar incêndio. |
| `/administrativo` | Guia em PDF para a área Administrativa: 8 semanas em 3 partes, diagnóstico e prompts de IA para e-mails, planilhas, atas e mapeamento de processos. |

Outros valores esperados:

- `sitemap.xml`: 7 URLs (home + 6 guias, host www, sem barra final), `lastmod` 2026-11-09 em todas (`ATUALIZADO_EM`, `lib/seo.ts`). Sem `/sobre`, `/privacidade`, `/termos`.
- `robots.txt`: `User-Agent: *`, `Allow: /`, `Disallow: /api/`, `Sitemap: https://www.copilotocarreira.com.br/sitemap.xml`.
- `Product.image`: `https://www.copilotocarreira.com.br/previews/<pasta>-p01.jpg`, com a pasta de `PREVIEW_PASTA` (`lib/guias.ts`), que nem sempre é igual ao slug:

  | Slug | Pasta | URL esperada em `Product.image` |
  |---|---|---|
  | financeiro | financeiro | `/previews/financeiro-p01.jpg` |
  | analise-de-dados | dados | `/previews/dados-p01.jpg` |
  | comercial | comercial | `/previews/comercial-p01.jpg` |
  | administrativo | administrativo | `/previews/administrativo-p01.jpg` |
  | marketing | marketing | `/previews/marketing-p01.jpg` |
  | customer-success | cs | `/previews/cs-p01.jpg` |

  Cada uma deve responder 200 `image/jpeg`; medido no ciclo 5 às 17:52:55Z, as 6 responderam assim. Sem `aggregateRating`.
- Home no celular (viewport 390x844, Playwright, produção, 2026-11-09 17:53Z): altura 3444 px = 4,08 telas; largura de rolagem 390 px (sem rolagem horizontal). Contagem de palavras, por método: texto do HTML bruto sem `<script>`/`<style>` = 473; `textContent` do `<main>` = 368; texto visível com acordeões fechados (`innerText` do `<body>`) = 264. O valor de 442 citado em ciclo anterior não se reproduziu com nenhum desses métodos; o Revalidador deve declarar qual método usa. A meta da Parte B (380 a 450 no HTML bruto) depende dessa escolha.
- `BreadcrumbList`: Início (`https://www.copilotocarreira.com.br`) > Guia de <Área> (URL canônica do guia).
- `Organization`: sem `sameAs` (omitido até existirem perfis reais).
- Sem FAQPage nem HowTo em nenhuma página.

## 3. Frases-âncora do FAQ (devem estar no HTML bruto)

| URL | Frases (todas presentes) |
|---|---|
| `/` | "Guias digitais em PDF por profissão, com etapas semanais"; "Os prompts são prontos: você copia, cola e ajusta ao seu caso"; "comece pela que ocupa a maior parte da sua semana" |
| cada guia | "As etapas I e II são iguais para todos"; "Os prompts funcionam nas versões gratuitas das ferramentas mais comuns"; e a frase própria do guia abaixo |
| `/financeiro` | "seja assistente, analista ou coordenação" |
| `/analise-de-dados` | "Os prompts de código são opcionais e explicados passo a passo" |
| `/comercial` | "As etapas tratam de rotina e posicionamento, que valem para os dois" |
| `/marketing` | "seja conteúdo, mídia paga, CRM ou marca" |
| `/customer-success` | "seja atendimento, onboarding ou gestão de carteira" |
| `/administrativo` | "seja em recepção, secretariado, compras, RH operacional ou backoffice" |

"[n]" deve ter 0 ocorrências em todas as páginas.

### 3.1 Resumos dos cartões (home e "Outros guias")

Fonte: `SEO_GUIAS[slug].resumo` em `lib/seo.ts`, renderizado por `components/site/GuiasCards.tsx`. A home mostra os 6; cada guia mostra os outros 5 (nunca o próprio). Cada afirmação do resumo precisa de lastro no texto visível da própria página do guia (teste "descriptions e resumos têm lastro no conteúdo visível", `tests/unit/seo-render.test.tsx:153`); foi aqui que o "às pressas" sem lastro passou despercebido num ciclo anterior. O Revalidador deve conferir o lastro lendo a página, não só a presença do texto.

| Guia | Resumo esperado (texto exato) |
|---|---|
| financeiro | Do fechamento do mês à mesa onde as decisões são tomadas. |
| analise-de-dados | Do “puxa esse relatório” à pessoa consultada antes da decisão. |
| comercial | Uma rotina de vendas que não depende de motivação. |
| administrativo | Uma rotina que mostra o seu valor e abre o próximo cargo. |
| marketing | Do relatório à mesa onde o investimento é decidido. |
| customer-success | Da fila de chamados à conta que a empresa quer proteger. |

Medido no ciclo 5 (HTML de produção de 17:25Z, sem `<script>`, entidades decodificadas): os 6 resumos presentes na home; em cada guia, os 5 resumos dos outros presentes e o próprio ausente.

## 4. Itens do checklist (Parte A, seção 2)

Aplicáveis: IDX-01 a IDX-08, IDX-11; META-01 a META-08; CON-01 a CON-09; SD-01, SD-02, SD-03 (Organization e WebSite na home, BreadcrumbList nos guias; Article não se aplica porque não há artigos), SD-04 (somente Product + Offer), SD-05; CWV-01 a CWV-08; SEC-01, SEC-02; A11Y-01; MOB-01; OPS-01, OPS-02, OPS-03, OPS-05.

Não aplicáveis (N/A), com justificativa:

| ID | Justificativa |
|---|---|
| OPS-04 | Não há migração de URLs: as 7 URLs mantiveram o caminho. |
| IDX-09 | Não há paginação. |
| IDX-10 | Não há facetas nem busca interna. |
| I18N-01 | Site só em pt-BR, sem versões de idioma. |
| LOC-01 | Não é negócio local. |
| VID-01 | Não há vídeo. |
| IMG-01 | As imagens são prévias do produto e prints de depoimentos, não conteúdo de busca de imagens; não há sitemap de imagens a exigir. |
| SD-04 (parte LocalBusiness) | Não é negócio local; só Product + Offer se aplicam. |

### 4.1 Definições a respeitar

- CON-05: matriz palavra-chave x URL sem canibalização entre os 6 guias. Intenção principal de cada guia = "guia de <área> em PDF" (o title começa por ela); a home = "guias de carreira em PDF com prompts de IA". Nenhum guia tem title, H1 ou description iguais aos de outro.
- CON-06: nenhuma página importante a mais de 3 cliques da home, e os 6 guias linkados entre si. Esperado no código: a home linka os 6 guias (`GuiasCards` e rodapé); cada guia linka os outros 5 em "Outros guias" e os 6 no rodapé (`components/site/Footer.tsx`), ou seja, todos a 1 clique da home.

## 5. Exceção conhecida: CWV-04 na home

`seo_audit.py` marca na home "Primeira imagem (provável LCP) sem loading=lazy" (P1). É falso positivo: o elemento LCP da home é texto.

Evidência (ciclo 5, Lighthouse 13.6.0, mobile, 3 execuções):
- Local 78e048c: elemento LCP `body.min-h-full > main.flex-1 > header.w-full > p.m-0` ("Um caminho de 8 semanas para a sua área…"), LCP mediano 764 ms.
- Produção (2026-11-09 ~17:37Z): mesmo elemento, LCP mediano 930 ms.
- A primeira `<img>` da home é um print de depoimento abaixo da dobra (`loading="lazy"`, 412x183). Arquivos: `docs/evidencias/ciclo5/t4_lcp_elemento_local.txt` e `t4_lcp_elemento_producao.txt`.

Nos 6 guias o elemento LCP é o H1 (texto). O script não deve ser alterado para "passar"; a exceção é registrada aqui.

## 6. Comandos do Revalidador

Salvar `seo_audit.py` e `check_http.sh` a partir das seções 6.6 e 6.7 do harness, numa pasta fora do repositório.

```bash
for P in / /financeiro /analise-de-dados /comercial /marketing /customer-success /administrativo; do python3 seo_audit.py "https://www.copilotocarreira.com.br$P" --json; done
```

```bash
bash check_http.sh https://www.copilotocarreira.com.br/marketing
```

Nota: o primeiro passo de `check_http.sh` usa `http://` (porta 80). Em ambientes com proxy só HTTPS ele falha com "Could not resolve host" e, por causa de `set -e`, interrompe o script; nesse caso rode os demais passos separadamente e registre o passo HTTP como nao_testavel.

```bash
for P in / /financeiro /analise-de-dados /comercial /marketing /customer-success /administrativo; do curl -s "https://www.copilotocarreira.com.br$P" | grep -c "\[n\]"; done
```

```bash
curl -s https://www.copilotocarreira.com.br/marketing | grep -c "seja conteúdo, mídia paga, CRM ou marca"
```

```bash
for P in "" /financeiro /analise-de-dados /comercial /marketing /customer-success /administrativo; do curl -s -o /dev/null -w "$P/opengraph-image %{http_code} %{content_type}\n" "https://www.copilotocarreira.com.br$P/opengraph-image"; done
```

```bash
for F in financeiro dados comercial administrativo marketing cs; do curl -s -o /dev/null -w "$F-p01.jpg %{http_code} %{content_type}\n" "https://www.copilotocarreira.com.br/previews/$F-p01.jpg"; done
```

```bash
curl -s https://www.copilotocarreira.com.br/marketing | grep -oE '<html[^>]*lang="[^"]*"|<meta name="(robots|googlebot|twitter:[a-z]+)"[^>]*>|<meta property="og:image"[^>]*>'
```

- Paridade HTML bruto x renderizado: Playwright (harness, seção 6.8) nas 7 URLs: title, um H1, canonical e JSON-LD presentes nos dois.
- Rich Results Test (manual, navegador): `/marketing` e mais um guia; esperado Product e BreadcrumbList sem erros.
- PageSpeed Insights mobile nas 7 URLs: campo (CrUX) se houver; senão laboratório.
- Teste negativo: copiar o HTML de `/marketing`, inserir `<meta name="robots" content="noindex">` e um segundo `<h1>`, servir localmente (`python3 -m http.server`) e confirmar que `seo_audit.py` falha em IDX-01 e CON-01.

## 7. Dados de laboratório do ciclo 5 (para referência, não substituem a medição do Revalidador)

Lighthouse 13.6.0, preset mobile padrão (throttling simulate), 3 execuções, mediana por métrica:

| Página | Local LCP / TBT / CLS | Produção LCP / TBT / CLS |
|---|---|---|
| `/` | 764 / 51 / 0 | 930 / 94 / 0 |
| `/financeiro` | 915 / 67 / 0 | 953 / 150 / 0 |
| `/analise-de-dados` | 917 / 98 / 0 | 953 / 122 / 0 |
| `/comercial` | 913 / 73 / 0 | 947 / 204 / 0 |
| `/marketing` | 908 / 60 / 0 | 957 / 141 / 0 |
| `/customer-success` | 916 / 42 / 0 | 951 / 127 / 0 |
| `/administrativo` | 915 / 58 / 0 | 953 / 142 / 0 |

O TBT em produção variou muito entre execuções (ex.: `/analise-de-dados` 119, 122, 269 ms; `/comercial` 206, 204, 195 ms). O servidor local não reproduz a CDN; a medição que vale para o gate é a da produção, feita por outra sessão.
