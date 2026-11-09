# Previews da Vercel: por que falham e o que cadastrar

Ciclo 5, 2026-11-09. Derivado do código do commit 78e048c e de builds reproduzidos localmente. Este documento não altera nada na Vercel: as ações são do dono.

## 1. O que o build exige

`lib/env.ts` valida o ambiente com zod no carregamento do módulo (`export const env = envSchema.parse(...)`, linha 56). O `next build` carrega as rotas de API na etapa "Collecting page data", então qualquer rota que importe `lib/env.ts` (direta ou indiretamente) faz o build falhar se o ambiente for inválido.

Rotas que importam `lib/env.ts` direta ou indiretamente (via `lib/db.ts`, `lib/email*.ts`):
`/api/internal/reconcile`, `/api/pix/create`, `/api/webhooks/mercadopago`, `/api/webhooks/resend`, `/api/orders/[id]/*`.

### Obrigatórias em tempo de build (ausência quebra o build)

| Variável | Regra em `lib/env.ts` | Build sem ela |
|---|---|---|
| `MP_ACCESS_TOKEN` | `z.string().min(1)` | falha em `/api/internal/reconcile` |
| `MP_WEBHOOK_SECRET` | `z.string().min(1)` | falha em `/api/internal/reconcile` |
| `DATABASE_URL` | `z.string().min(1)` | falha em `/api/internal/reconcile` |
| `SUPABASE_URL` | `z.string().url()` | falha em `/api/internal/reconcile` |
| `SUPABASE_SERVICE_ROLE_KEY` | `z.string().min(1)` | falha em `/api/internal/reconcile` |

`/api/internal/reconcile` é só a primeira rota avaliada; as demais da lista acima falhariam pelo mesmo motivo.

### Opcionais, mas validadas no build quando presentes (valor inválido quebra o build)

| Variável | Regra | Reproduzido |
|---|---|---|
| `RECONCILE_SECRET` | mínimo 32 caracteres | sim (`RECONCILE_SECRET=curto` falha) |
| `SUPABASE_URL` | precisa ser URL | sim (`nao-e-url` falha) |
| `MP_PIX_EXPIRATION` | duração ISO 8601 | sim (`30min` falha) |
| `EMAIL_BATCH_SIZE` | inteiro positivo até 50 | não reproduzido |
| `PIX_CREATE_RATE_LIMIT`, `MP_WEBHOOK_RATE_LIMIT` | inteiro positivo | não reproduzido |

Atenção: uma variável cadastrada com valor vazio na Vercel chega como string vazia, e `min(1)` a rejeita.

### Só em tempo de execução (o build passa sem elas)

`APP_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `MP_API_BASE_URL` (só harness). `VERCEL_ENV` é definida pela própria Vercel; com valor diferente de `production`, as páginas `/sobre`, `/privacidade` e `/termos` renderizam como rascunho com `noindex` (`lib/institucional.ts`).

Evidência: `docs/evidencias/ciclo5/t3_build_sem_variavel.txt` (comandos e trechos de saída). Controle positivo: o mesmo commit com todas as variáveis fictícias compila 29/29 páginas.

## 2. Causa da falha dos previews

Resultado medido localmente: sem qualquer uma das 5 variáveis obrigatórias, o build falha com `ZodError` em `/api/internal/reconcile`.

Não medido (nao_testavel): o log do deploy de preview na Vercel. A hipótese de que as 5 variáveis estão cadastradas só no escopo Production é compatível com o erro reproduzido, mas só o log confirma. Comando para o dono: `npx vercel inspect dpl_EFyQu2Xv4LGgVqiW3qa8fjeRLC6a --logs`, procurando por `ZodError` e pelo nome da variável no campo `path`.

## 3. O que cadastrar no escopo Preview (somente credenciais de teste)

Nunca copie para Preview as chaves de Production. Um preview é acessível por URL e roda o mesmo código de pagamento e e-mail.

| Variável | Valor recomendado em Preview |
|---|---|
| `MP_ACCESS_TOKEN` | token de TESTE do Mercado Pago (DevPanel > Credenciais > aba Teste) |
| `MP_WEBHOOK_SECRET` | segredo do webhook da aplicação de teste |
| `DATABASE_URL` | Postgres de um projeto Supabase separado, só para preview |
| `SUPABASE_URL` | URL desse projeto separado |
| `SUPABASE_SERVICE_ROLE_KEY` | service role desse projeto separado |
| `RESEND_API_KEY` (opcional) | chave de teste ou de um domínio de teste; sem ela o envio fica pausado e o build passa |
| `APP_URL` (opcional) | pode ficar vazia em preview |
| `RECONCILE_SECRET` (opcional) | deixar vazia em preview (rota fica desligada) ou usar um valor de 32+ caracteres exclusivo do preview |

Ver também a documentação da Vercel sobre escopos de variáveis (Production, Preview, Development).

## 4. Alternativa (somente proposta, NÃO implementada)

`lib/env.ts` está na área proibida deste ciclo (regra R5). Proposta para avaliação do dono:

- Trocar a validação no carregamento do módulo por uma função `getEnv()` com memoização, chamada dentro dos handlers das rotas de API. O build deixaria de exigir credenciais; um preview sem segredos publicaria as páginas de venda, e as rotas de pagamento responderiam 503 até o ambiente estar completo.
- Custo: o erro de configuração deixa de aparecer no build e passa a aparecer na primeira requisição. Mitigação: um teste de inicialização (ou um passo de CI) que chama `getEnv()` com o ambiente de Production.
- Mudança afeta pagamento e e-mail: exige PR próprio, testes de integração e o e2e do fluxo de compra.
