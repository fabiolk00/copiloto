-- Envio do guia por e-mail (padrão outbox).
--
-- O estado do e-mail vive no próprio pedido. A transição para `pago` já grava
-- `email_status = 'pendente'` NA MESMA instrução (ver markPedidoStatus em
-- lib/pedidos.ts), então não existe janela entre "pago" e "na fila".
-- Esta migration NÃO enfileira pedidos que já estão pagos: eles ficam com
-- `email_status` nulo até alguém autorizar o backfill (ver scripts/backfill-email-guia.sql).
--
-- Estados de `email_status`:
--   pendente   na fila, elegível quando `email_proxima_tentativa <= now()`
--   enviando   reivindicado por um worker até `email_lock_ate` (lease)
--   enviado    aceito pelo Resend (guardamos `resend_email_id`)
--   entregue   o Resend confirmou a entrega (webhook)
--   rejeitado  bounce definitivo ou reclamação: nunca mais tentamos
--   falhou     erro permanente nosso ou tentativas esgotadas: exige olhar humano

alter table public.pedidos
  add column if not exists email_status text
    check (email_status in ('pendente', 'enviando', 'enviado', 'entregue', 'rejeitado', 'falhou')),
  add column if not exists email_tentativas integer not null default 0,
  add column if not exists email_proxima_tentativa timestamptz,
  add column if not exists email_lock_ate timestamptz,
  add column if not exists email_enviado_em timestamptz,
  add column if not exists email_entregue_em timestamptz,
  add column if not exists email_ultimo_erro text,
  add column if not exists resend_email_id text,
  -- Quantos reenvios manuais já foram pedidos; também compõe a chave de idempotência.
  add column if not exists email_reenvios integer not null default 0,
  add column if not exists email_ultimo_reenvio_em timestamptz;

create unique index if not exists pedidos_resend_email_id_key
  on public.pedidos (resend_email_id) where resend_email_id is not null;

create index if not exists pedidos_email_fila_idx
  on public.pedidos (email_proxima_tentativa)
  where email_status in ('pendente', 'enviando');

-- Fonte única de "o que o worker deve enviar agora". Usada pelo app (worker)
-- e pelo disparo no banco (pg_cron), para os dois nunca divergirem.
create or replace view public.pedidos_email_a_enviar
with (security_invoker = true) as
select id
from public.pedidos
where status = 'pago'
  and (
    (email_status = 'pendente' and email_proxima_tentativa <= now())
    or (email_status = 'enviando' and email_lock_ate < now())
  );
