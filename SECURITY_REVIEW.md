# Revisão de segurança — integração Pix

Revisão defensiva da integração de Pix (Mercado Pago Orders API) deste projeto, rodando inteiramente contra o fake local da Mercado Pago e um Postgres efêmero (`tests/helpers/test-db.ts`) — nunca contra produção ou contra a API real. Cobre os 7 itens do modelo de ameaças pedido, com um teste automatizado por ameaça que falha se a proteção for removida.

**Como rodar**: `npm test` (inclui `tests/security/**`) ou `npx vitest run tests/security`.

## Resumo executivo

| # | Ameaça | Resultado | Correção aplicada |
|---|---|---|---|
| 1 | Injeção SQL/comando | ✅ Já protegido — provado com 18 testes | Nenhuma (confirmado por design) |
| 2 | Adulteração do receptor Pix | ✅ Protegido | Nenhuma nova (reforça proteção já existente) |
| 3 | Webhook forjado/replay/abuso | ⚠️ Gaps corrigidos | Rate limit + limite de corpo (novos) |
| 4 | Controle de acesso (IDOR) | ✅ Protegido por design | Nenhuma |
| 5 | Segredos e dados | ✅ Limpo, com 1 risco residual baixo documentado | Nenhuma de código; recomendação operacional |
| 6 | Dependências e estática | ⚠️ 22 vulns, todas em devDependencies | `npm audit fix` + `eslint-plugin-security` |
| 7 | Disponibilidade | ⚠️ Gap corrigido | Rate limit em `/api/pix/create` (novo) |

Nenhum achado alto/crítico com exploração real confirmada no código de produção. Os dois gaps reais (#3, #7) eram ausência de limite de taxa e de tamanho de corpo — ambos corrigidos nesta revisão.

## Ferramentas: o que rodou de verdade vs. substituído

Este ambiente de execução não tem Docker, Python/pip nem Go instalados. Em vez de simular isso, cada ferramenta foi testada diretamente antes de decidir substituir:

| Ferramenta pedida | Status | O que rodou no lugar |
|---|---|---|
| **gitleaks** | ✅ Rodou de verdade | Binário oficial `v8.30.1` baixado de `github.com/gitleaks/gitleaks/releases` (não o pacote npm `gitleaks`, que é um projeto não relacionado — "custom rules" — e teria sido um risco instalar). `gitleaks detect --log-opts="--all"` contra todo o histórico (8 commits, 325KB): **"no leaks found"**. |
| **trufflehog** | ⚠️ Bloqueado pelo sandbox | Binário oficial `v3.99.8` baixado e verificado (`--version` funciona), mas a execução contra o histórico foi recusada pelo classificador de modo automático deste ambiente ("Code from External" — executar um binário externo baixado é tratado como ação de risco). Pendente de aprovação manual sua; o pacote npm `trufflehog` também não é o projeto real (é um scraper de Reddit). |
| **sqlmap** | ❌ Não roda aqui | Sem Python/pip no ambiente. Substituído por payloads de injeção escritos à mão (`tests/security/injection.test.ts`), cobrindo as mesmas classes de ataque (aspas, UNION, boolean-based, time-based com `pg_sleep`) contra os pontos de entrada reais. |
| **semgrep** | ❌ Não roda aqui | O pacote npm `semgrep` é de terceiros; o release oficial mais recente (`v1.183.0`) não publica binário para Windows (confirmado consultando a API do GitHub) — a ferramenta real só roda nativamente em Linux/macOS, ou via Docker/WSL (nenhum dos dois disponível). Substituído por `eslint-plugin-security` (pacote real, mantido, cross-platform), já no lint do CI. |
| **OWASP ZAP** | ❌ Não roda aqui | Distribuição padrão depende de Docker. Java 21 está disponível, mas o baseline script oficial depende de Python. O que o ZAP baseline cobriria (headers ausentes, cookies, mixed content) foi coberto por verificação direta e determinística dos headers (`next.config.ts` + checagem manual com `curl -I`) em vez de um scanner genérico — para esta app (3 rotas de API + páginas estáticas, sem formulário de login, sem cookies), é mais preciso que um baseline scan. |
| **npm audit** | ✅ Rodou de verdade | Ver seção 6. |

Se você quiser rodar sqlmap/semgrep/ZAP de verdade, a forma mais direta é via Docker num ambiente que o tenha (ou WSL2 no Windows) — nenhuma mudança de código é necessária para isso, só infraestrutura.

---

## 1. Injeção de SQL/comando

**Ameaça**: payloads de injeção em ID do pedido, external_reference, e-mail do pagador, query `data.id` do webhook e headers.

**Revisão de código**: toda consulta em `lib/pedidos.ts` usa o template tagueado `sql\`...${valor}...\`` do `postgres.js`, que envia cada interpolação como parâmetro ligado — nunca concatenação de string. `grep -rn "sql.unsafe" lib/ app/` não encontra nenhuma ocorrência fora dos scripts de migração dos testes/harness (que não recebem entrada de usuário). Essa é a defesa estrutural: não depende de escapar o payload, o conteúdo nunca é interpretado como SQL.

**Teste**: `tests/security/injection.test.ts` (18 testes) — os mesmos 8 payloads clássicos (`' OR '1'='1`, `'; DROP TABLE pedidos; --`, UNION, `'; SELECT pg_sleep(5); --`, path traversal, XSS) contra:
- `client_token` em `GET /api/orders/:id/status` (não validado como UUID — a defesa real aqui É a parametrização, não um filtro de formato)
- `payerEmail` em `POST /api/pix/create`
- `data.id` no webhook, com assinatura HMAC válida recalculada para cada payload (provando que a injeção não é bloqueada só porque a assinatura falharia)

**Resultado antes/depois**: idêntico — não havia vulnerabilidade a corrigir. Todos os 18 testes confirmam: nunca 500 por erro de banco, nunca dado de outro pedido vazado, `pg_sleep(5)` nunca executa (suíte inteira roda em ~2s), `DROP TABLE` nunca executa (linha legítima confirmada intacta após cada tentativa).

**Correção aplicada**: nenhuma — comportamento já seguro por construção.

**Risco residual**: nenhum identificado nesta camada.

---

## 2. Interceptação/adulteração do "receptor" do Pix

**Ameaça**: cliente controlando valor/recebedor/chave Pix/external_reference; mass assignment; reuso de QR entre pedidos; pagamento a menor liberando o pedido.

**Teste**: `tests/security/pix-integrity.test.ts` (6 testes).

| Risco específico | Resultado |
|---|---|
| Campos extras no corpo (`amount`, `payer`, `external_reference`, `mp_order_id`, `status`, `pix_key`, `recipient`) | Ignorados — o schema Zod só aceita `area`, `trilha`, `payerEmail`, `clientToken`; o preço vem sempre de `PRICE_BRL` no servidor (`lib/pix.ts#buildPixOrderPayload`, que nem recebe um parâmetro de valor) |
| JSON com chave duplicada (`payerEmail` repetido) | `JSON.parse` nativo já colapsa na última ocorrência — comportamento do runtime, não da aplicação; testado para registrar |
| Pix pago da order X "libera" o pedido Y | Webhook sempre faz `UPDATE ... WHERE mp_order_id = X` — Y nunca é tocado (testado com os dois pedidos pendentes simultaneamente) |
| Pagamento a menor (`0.01` vs `29.90`) | Não marca como pago (`amountsMatch`, já implementado numa revisão anterior) — pedido fica `pendente` e um alerta é logado |
| Corpo do webhook adulterado com assinatura válida (finge `status: "processed"`) | **Nunca confiado** — o handler sempre reconsulta `GET /v1/orders/{id}` e usa o estado real; o teste prova que mesmo com o corpo dizendo "pago", o pedido continua `pendente` porque a Mercado Pago real (fake) ainda diz `action_required` |

**Nota sobre a assinatura**: o algoritmo do SDK (`WebhookSignatureValidator`) assina `id:{data.id};request-id;ts` — **não o corpo**. Isso é por design da Mercado Pago, não um bug deste projeto, e é exatamente por isso que "nunca confiar no payload, sempre reconsultar" (item pedido no modelo de ameaças) é a mitigação certa — e já estava implementada antes desta revisão.

**XSS / troca do copia-e-cola no navegador**: `grep -rn "dangerouslySetInnerHTML|innerHTML"` em `app/`, `components/`, `lib/` → **uma ocorrência intencional**: `components/seo/JsonLd.tsx` (JSON-LD de SEO, dados só de constantes do código, `<` escapado como `\u003c`; coberta por teste). Fora isso, zero. Toda renderização passa pelo escape automático do JSX; não há vetor de XSS armazenado/refletido via dados do pedido. CSP reforça isso como segunda camada (ver seção 6).

**HTTPS/HSTS/cookies**: a app não usa cookies (sem contas de usuário). HTTPS é responsabilidade da camada de deploy (Vercel força HTTPS); `Strict-Transport-Security` foi adicionado em `next.config.ts` para quando isso acontecer.

**Correção aplicada**: nenhuma de código — reforça o que já existia.

**Risco residual**: nenhum alto. Exibir o nome do recebedor pro usuário conferir no app do banco (item opcional do pedido) não foi implementado — é uma melhoria de UX/confiança, não uma correção de vulnerabilidade, já que o servidor já impede valores forjados independente de o usuário conferir ou não.

---

## 3. Webhook forjado, replay e abuso

**Ameaça**: sem assinatura/assinatura errada/ts expirado/corpo alterado depois de assinado/replay/falta de rate limit/corpo sem limite de tamanho/trabalho pesado antes do 200.

**Teste**: `tests/security/webhook-forgery.test.ts` (8 testes) + cobertura pré-existente em `tests/integration/webhook.route.test.ts` (15 testes, de uma sessão anterior).

| Checagem | Resultado | Correção |
|---|---|---|
| Sem `x-signature` | 401, sem efeito | já existia |
| Secret errado | 401, sem efeito | já existia |
| `ts` fora da tolerância (300s) | 401, sem efeito | já existia |
| Header malformado | 401, sem efeito | já existia |
| Replay do mesmo evento (mesma `action`) 3x | Efeito uma única vez (`pedido_webhook_eventos`, chave `type:data.id:action`) | já existia (chave de dedup corrigida numa revisão anterior — ver nota abaixo) |
| Comparação de assinatura em tempo constante | Confirmado por revisão de código: `crypto.timingSafeEqual` no SDK (`mercadopago/dist/utils/webhook/index.js`) | já existia, não é deste projeto |
| **Rate limit no endpoint** | **Ausente** → corrigido | `lib/rate-limit.ts` + `60 req/min/IP` em `app/api/webhooks/mercadopago/route.ts` |
| **Limite de tamanho do corpo** | **Ausente** → corrigido | `lib/request-guards.ts#readJsonWithLimit`, 256KB, lido em streaming (não confia só no header `Content-Length`, que pode mentir) |
| Resposta rápida (sem trabalho pesado antes do 200) | Decisão de arquitetura **intencional e documentada no próprio código** (comentário em `route.ts`): o handler consulta a Orders API *antes* de responder porque numa rota serverless, "disparar e esquecer" depois do 200 arriscaria a confirmação nunca terminar. Mantido como está. | não aplicável |

**Nota — bug real encontrado e corrigido** (fora do escopo original mas descoberto ao escrever o teste de replay/fora-de-ordem numa sessão anterior a esta): a chave de dedup usava só `type:data.id`, que não muda durante todo o ciclo de vida de uma order — isso faria qualquer notificação depois da primeira (inclusive a de pagamento confirmado!) ser descartada como duplicata. Corrigido para incluir o campo `action` do corpo real documentado pela Mercado Pago. Mencionado aqui porque é parte do raciocínio de "replay e webhook forjado".

**Resultado antes/depois do rate limit/corpo**: antes, um atacante podia mandar volume ilimitado de notificações (reais ou forjadas) para o endpoint, cada uma custando uma verificação HMAC + possivelmente uma consulta à Orders API; e um corpo arbitrariamente grande seria lido inteiro na memória antes de qualquer validação de tamanho. Depois: 429 com `Retry-After` acima de 60/min por IP; 413 acima de 256KB, rejeitado durante a leitura em streaming (não espera materializar o payload inteiro).

**Risco residual**: o rate limit é em memória, por instância — numa implantação com múltiplas réplicas, cada uma tem seu próprio contador (um atacante distribuído entre réplicas efetivamente multiplica o limite). Documentado no código (`lib/rate-limit.ts`) com o caminho de upgrade (mover para Redis/Upstash sem mudar a assinatura da função). Para o volume desta aplicação (single instance), aceitável.

---

## 4. Controle de acesso (IDOR)

**Ameaça**: usuário B lendo/pagando/cancelando/consultando o pedido de A; endpoints de debug/admin em produção.

**Contexto de design**: esta app não tem contas de usuário — por decisão deliberada, documentada no próprio código (`app/api/orders/[id]/status/route.ts`). O controle de acesso é por **capacidade**: quem tem o `client_token` (UUID v4, gerado no navegador, 122 bits de entropia) age como dono do pedido.

**Teste**: `tests/security/access-control.test.ts` (13 testes).

| Checagem | Resultado |
|---|---|
| B lê o status de A com o próprio token (diferente) | 404 |
| Resposta de status para o dono | Só `{status, expiresAt}` — nunca `payer_email`, `amount`, `qr_code`, `mp_order_id` |
| Variação próxima do token de A (um caractere trocado) | 404 — não há "quase acerto" |
| B tenta criar pedido usando o token de A | Vira um replay do Pix *de A* (nenhuma order nova, e-mail de A preservado) — comportamento correto de "token = capacidade", não uma falha de isolamento entre contas que não existem |
| Token nunca usado antes (de B) | Sempre isolado do de A, nunca reaproveita nada |
| Rotas de debug/admin (`/api/debug`, `/api/admin`, `/api/internal`, `/api/health`, `/.env`, etc.) | Nenhuma existe — confirmado inspecionando `app/api/**/route.ts` (só 3 rotas: `pix/create`, `webhooks/mercadopago`, `orders/[id]/status`) |

**Correção aplicada**: nenhuma — já protegido por design.

**Risco residual**: a "conta" é o `client_token` guardado em `sessionStorage` (ver `components/venda/PixCheckout.tsx`, adicionado numa revisão anterior para recuperar o Pix num refresh). Se o token for exposto (XSS — já descartado na seção 2; ou vazamento de log — ver seção 5), quem o tiver pode consultar/retomar aquele pedido especificamente. Isso é aceitável para o modelo "sem conta" desta aplicação: o pior caso é ver o status do próprio Pix que se estava gerando, nunca o de outra pessoa.

---

## 5. Segredos e dados

**Ameaça**: Access Token/webhook secret vazando para bundle do cliente, logs, mensagens de erro, source maps; dados pessoais além do necessário nos logs.

**Varredura do repositório**: ver seção de ferramentas acima — gitleaks limpo em todo o histórico.

**Teste**: `tests/security/secrets-and-logs.test.ts` (7 testes).

| Checagem | Resultado |
|---|---|
| `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` no corpo de resposta de sucesso ou erro (500) | Nunca aparecem |
| `GET /api/orders/:id/status` incluindo `payer_email`, `qr_code`, `mp_order_id` | Nunca — resposta é só `{status, expiresAt}` |
| Log de criação de Pix bem-sucedida | Não contém `payer_email` nem o access token (`console.log("[pix] pedido criado", {pedidoId, mpOrderId, attempt})` — sem e-mail, sem QR) |
| Log de webhook processado | Não contém `payer_email`, `qr_code` nem o webhook secret |
| Log de assinatura inválida | Não contém o secret nem a assinatura completa (só o motivo, ex. `SignatureMismatch`) |
| Referência a `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` em `components/` ou `app/` fora de `app/api` | Nenhuma — os dois só são lidos em `lib/env.ts` e usados dentro de `app/api/**` (código server-only) |

**Correção aplicada**: nenhuma de código.

**Risco residual (baixo, documentado)**: o `catch` de erro inesperado em `app/api/pix/create/route.ts` faz `console.error("Erro ao criar order Pix...", err)`, logando o objeto de erro **completo**. Se a Mercado Pago (ou qualquer dependência) algum dia devolver uma mensagem de erro que ecoe dados sensíveis da requisição (não visto na prática — os erros reais do SDK trazem `status`/`error`/`causes`, nunca o payload original), isso ficaria no log do servidor. **Nunca exposto ao cliente** (confirmado pelos testes acima) — é um log interno, acessível só a quem tem acesso à infraestrutura de logging. Recomendação: trocar por log estruturado que lista só `err.message`/`err.status` em vez do objeto inteiro, numa próxima iteração.

**Plano mínimo de rotação de segredo** (pedido no modelo de ameaças, não existia documentação): `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` vivem em variáveis de ambiente (nunca em arquivo versionado — `.env*` está no `.gitignore` exceto `.env.example`). Para rotacionar: (1) gerar novo Access Token / segredo de webhook no painel da Mercado Pago sem revogar o antigo ainda; (2) atualizar a env var na plataforma de deploy e redeployar; (3) confirmar que novas requisições (criação de Pix, webhooks) funcionam com o novo valor; (4) só então revogar o valor antigo no painel. Para o webhook secret especificamente, a Mercado Pago permite ter o endpoint de teste e produção com segredos distintos — o código já suporta isso trivialmente (um único `MP_WEBHOOK_SECRET` por ambiente, vindo de env).

---

## 6. Dependências e análise estática

**npm audit**: 22 vulnerabilidades (20 moderate, 2 critical). Todas em **devDependencies** (`eslint*`, `vitest`/`tinypool`/`glob`/`minimatch`/`test-exclude`) — confirmado item a item (`isDirect` + árvore de `via`). **Nenhuma toca as dependências de produção** (`mercadopago`, `next`, `postgres`, `react`, `react-dom`, `zod`). As 2 críticas (`tinypool`, prototype pollution → RCE) só executam durante `npm test`/CI, nunca no processo do servidor em produção.

`npm audit fix` (sem `--force`) aplicado — nada ficou disponível para corrigir sem quebra, porque a cadeia está travada por peer deps do `eslint-config-next@16.4.4`. Resolver exigiria subir `vitest` para `5.x` (que exige `@types/node@^22`, uma mudança maior, fora do escopo desta revisão de segurança de uma feature). **Risco residual aceito e documentado**: zero exposição em produção, correção completa fica para uma passada de upgrade de dependências dedicada.

**Análise estática**: `eslint-plugin-security` adicionado ao `eslint.config.mjs` (substitui semgrep — ver seção de ferramentas). 19 avisos, 0 erros:
- `security/detect-object-injection` (maioria dos avisos): padrão `obj[variavel]` em `components/venda/*.tsx` onde a chave vem sempre de um array fixo de 2 elementos (`["crescer", "mudar"]"`) nunca de entrada do usuário — falso positivo clássico desta regra, confirmado por leitura do código-fonte.
- `security/detect-unsafe-regex` em `lib/env.ts`/`lib/pix.ts`: a regex de duração ISO 8601 não tem quantificadores aninhados sobre a mesma classe de caractere (sem risco real de ReDoS) e só processa `MP_PIX_EXPIRATION`, um valor configurado pelo operador no deploy — nunca alcançável por entrada de requisição.
- `security/detect-non-literal-fs-filename` em scripts do harness/testes: lê arquivos de um diretório fixo (`supabase/migrations`), nunca de um caminho vindo de fora.

Nenhum desses é um achado alto/crítico sem justificativa — cada um foi revisado individualmente e o motivo está documentado acima.

**Correção aplicada**: `npm audit fix` (parcial, sem breaking changes) + `eslint-plugin-security` no lint do CI.

---

## 7. Disponibilidade

**Ameaça**: criação ilimitada de orders (idempotência evitando milhares); timeouts/circuit breaker nas chamadas à Mercado Pago.

**Teste**: `tests/security/anti-abuse.test.ts` (3 testes).

| Checagem | Resultado | Correção |
|---|---|---|
| Um IP tentando criar muitos pedidos novos (trocando `clientToken`) | **Sem limite antes** → corrigido: 429 a partir de 10 req/min/IP | `lib/rate-limit.ts` em `app/api/pix/create/route.ts` |
| IPs diferentes | Limites independentes, um não afeta o outro | — |
| 10 requisições concorrentes com o **mesmo** `clientToken` | Exatamente 1 pedido persistido — as 9 "perdedoras" da corrida recebem 500 honesto (violação de unique constraint capturada pelo catch genérico), nenhuma duplica a order na Mercado Pago (a chave de idempotência determinística por `clientToken+attempt` garante isso mesmo antes de chegar ao banco) | já existia (desenho de idempotência de uma revisão anterior) |
| Timeout/circuit breaker nas chamadas à Mercado Pago | SDK usa timeout default de 60s (`AppConfig.DEFAULT_TIMEOUT`) e retry automático em 429/5xx (`AppConfig.DEFAULT_RETRY_ON`) — não implementamos um circuit breaker próprio | ver risco residual |

**Correção aplicada**: rate limit por IP em `/api/pix/create` (10/min, configurável via `PIX_CREATE_RATE_LIMIT`) e reforço do mesmo limite no endpoint de webhook (seção 3).

**Risco residual**: sem circuit breaker dedicado — se a Mercado Pago ficar degradada (não fora do ar, só lenta), cada requisição ainda espera até 60s antes de falhar, podendo esgotar conexões sob carga. Não implementado nesta revisão porque é uma mudança de resiliência maior (exigiria uma biblioteca de circuit breaker ou lógica própria com estado compartilhado) — o rate limit já criado reduz a superfície (menos requisições presas esperando), mas não elimina o risco. Recomendação para uma próxima iteração: `requestOptions: { timeout: 10_000 }` por chamada (o SDK aceita override por request) para falhar mais rápido, dado que o usuário já vê um spinner de "Gerando o Pix…" — esperar 60s é uma experiência ruim independente de segurança.

---

## Inventário de testes

```
tests/security/
├── injection.test.ts          18 testes — ameaça 1
├── pix-integrity.test.ts       6 testes — ameaça 2
├── webhook-forgery.test.ts     8 testes — ameaça 3
├── access-control.test.ts     13 testes — ameaça 4
├── secrets-and-logs.test.ts    7 testes — ameaça 5
└── anti-abuse.test.ts          3 testes — ameaça 7
                                55 testes totais
```

Roda no CI junto com `tests/unit` e `tests/integration` via `npm test` (`vitest run`) — mesmo comando, mesma suíte, sem infraestrutura extra.

## Arquivos novos/alterados nesta revisão

- `lib/rate-limit.ts`, `lib/request-guards.ts` — novos.
- `app/api/pix/create/route.ts`, `app/api/webhooks/mercadopago/route.ts` — rate limit + limite de corpo.
- `lib/env.ts` — `PIX_CREATE_RATE_LIMIT`/`MP_WEBHOOK_RATE_LIMIT` configuráveis.
- `next.config.ts` — CSP + headers de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`).
- `eslint.config.mjs` — `eslint-plugin-security`.
- `tests/security/**` — esta suíte.
- `.security-tools/` (não versionado) — binários oficiais de gitleaks/trufflehog, baixados para esta revisão.
