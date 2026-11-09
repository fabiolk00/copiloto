# Fluxo de dados pessoais: insumo para a política de privacidade

Ciclo 5, 2026-11-09. Para o advogado que vai revisar `/privacidade`. Derivado do código do commit 78e048c (leitura, sem alteração). Cada linha cita o arquivo de origem. O que o código não mostra está marcado `nao_determinado`: precisa vir do contrato com o fornecedor ou do painel dele, nunca de suposição.

A página `/privacidade` continua com `publicada: false` (`lib/institucional.ts`) e responde 404 em produção.

## 1. Dados coletados

| Dado | Origem | Onde é guardado | Fonte no código |
|---|---|---|---|
| E-mail do comprador | formulário do checkout Pix | tabela `public.pedidos`, coluna `payer_email` | `app/api/pix/create/route.ts:31` (`payerEmail: z.string().email()`); `supabase/migrations/20261102120000_create_pedidos.sql` |
| Guia escolhido e trilha | checkout | `pedidos.area_slug`, `pedidos.trilha` | mesma migration |
| Valor, moeda e situação do pagamento | servidor | `pedidos.amount`, `currency`, `status`, `expires_at`, `created_at`, `updated_at` | mesma migration |
| Identificadores do pagamento no Mercado Pago, QR code Pix e link do ticket | resposta do Mercado Pago | `pedidos.mp_order_id`, `qr_code`, `ticket_url`, `external_reference` | mesma migration |
| Token de acesso do pedido (bearer do link de download) | gerado no checkout | `pedidos.client_token` | `supabase/migrations/20261102121500_add_pedidos_client_token.sql` |
| Situação do envio do e-mail (entregue, devolvido, reclamação), id da mensagem no Resend, tentativas e último erro | worker de e-mail e webhook do Resend | colunas `email_*` e `resend_email_id` de `pedidos` | `supabase/migrations/20261104120000_email_guia_outbox.sql`; `app/api/webhooks/resend/route.ts` |
| Eventos de webhook recebidos (tipo e id do recurso, sem conteúdo pessoal) | Mercado Pago e Resend | `public.pedido_webhook_eventos` (`event_key`, `type`, `data_id`, `received_at`) | `supabase/migrations/20261102120000_create_pedidos.sql` |
| Endereço IP | cabeçalhos `x-forwarded-for` / `x-real-ip` | só em memória do processo, para limite de taxa; não é gravado no banco | `lib/rate-limit.ts:57-60` |
| E-mail, token do pedido e trilha no navegador | checkout | `sessionStorage` do navegador do comprador (apagado ao fechar a aba) | `components/venda/PixCheckout.tsx:25-58` |
| Eventos de clique (`click_cta` com área, trilha, posição), sem dado pessoal | navegador | `window.dataLayer`; nenhum script de terceiros lê esse array no código atual | `lib/track.ts`; `components/venda/PixCheckout.tsx:210` |
| Métricas de navegação (Vercel Web Analytics) | navegador | Vercel | `app/layout.tsx:3` e `:38` (`<Analytics />` de `@vercel/analytics`) |
| Logs de servidor com id do pedido e id do Mercado Pago (sem e-mail) | servidor | logs da Vercel | `app/api/pix/create/route.ts:160` |

Dados bancários: o site não recebe. O Pix é pago no app do banco do comprador, a partir do QR code do Mercado Pago (`lib/pix.ts:51` envia ao Mercado Pago apenas `payer: { email }`).

Arquivos: o bucket privado `pdfs` do Supabase Storage guarda os PDFs dos guias e o modelo de currículo, não dados do comprador (`lib/storage.ts:2`, `:18`). O download usa URL assinada de 300 segundos (`lib/storage.ts:21`).

## 2. Fornecedores que recebem dados

| Fornecedor | O que recebe | Fonte | País ou região de processamento |
|---|---|---|---|
| Mercado Pago | e-mail do comprador, valor, referência do pedido | `lib/pix.ts:51` | nao_determinado no código |
| Resend | e-mail do comprador (destinatário), corpo do e-mail com links de download que contêm o token do pedido | `lib/email.ts:91`; `lib/email-template.ts:4`, `:82-84` | nao_determinado no código |
| Supabase | banco Postgres (tabelas acima) e Storage | `.env.example` (`DATABASE_URL`, `SUPABASE_URL`); `lib/db.ts`; `lib/storage.ts` | nao_determinado no código (a região do projeto aparece no painel do Supabase) |
| Vercel | hospedagem, logs de servidor, IP de cada requisição, Web Analytics | `app/layout.tsx:38`; `next.config.ts` | nao_determinado no código (a região da função aparece no painel; as respostas medidas no ciclo 5 vieram do nó `iad1`, mas isso é a borda da CDN usada pela rede do teste, não prova onde os dados ficam) |

Nenhum outro fornecedor aparece no código: não há Google Analytics, GTM, Meta Pixel nem chat. A CSP (`next.config.ts`) só permite `connect-src 'self'`.

## 3. Retenção

| Dado | Prazo no código | Fonte |
|---|---|---|
| `pedido_webhook_eventos` | apagados após 30 dias (job `pg_cron`) | `supabase/migrations/20261103140100_pg_cron_reconciliacao.sql:75` |
| `pedidos` (inclui e-mail) | nao_determinado: nenhum job apaga ou anonimiza pedidos. A migration `20261103160000_expirar_pedidos.sql` só muda o status de pedidos não pagos | `supabase/migrations/` |
| Logs da Vercel | nao_determinado (configuração do plano da Vercel) | — |
| Dados no Resend e no Mercado Pago | nao_determinado (política de cada fornecedor) | — |

## 4. Cookies e analytics

- Cookies definidos pelo código do site: nenhum encontrado (`grep -rnE "document\.cookie|cookies\(\)|Set-Cookie|\.cookies\." app components lib` sem ocorrência). As respostas de produção das 7 páginas em 2026-11-09 17:25Z não trazem `Set-Cookie`. O fluxo de compra (rotas de API) não foi medido em produção.
- Armazenamento local: só `sessionStorage` do checkout (seção 1).
- Vercel Web Analytics: ativo em todas as páginas. Se usa cookies ou identificadores, e por quanto tempo: nao_determinado pelo código; confirmar na documentação da Vercel.

## 5. Perguntas que só o dono ou o advogado respondem

1. Controlador (nome ou razão social e documento).
2. Base legal de cada finalidade (LGPD, art. 7º).
3. Países e mecanismo da transferência internacional de cada fornecedor (LGPD, art. 33).
4. Prazo de guarda dos pedidos e do e-mail; se haverá rotina de anonimização.
5. Encarregado (DPO) e prazo de resposta a titulares.
6. Se o Web Analytics da Vercel exige aviso ou consentimento.
