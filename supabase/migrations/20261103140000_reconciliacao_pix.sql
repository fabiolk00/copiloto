-- Reconciliação de Pix e dedup de webhook que só vale após sucesso.
--
-- Problema anterior: `pedido_webhook_eventos` gravava a chave ao RECEBER a
-- notificação. Se o processamento falhasse depois, a chave já estava
-- consumida, as reentregas da Mercado Pago eram descartadas como duplicadas e
-- o pagamento nunca era confirmado.
--
-- Agora o evento tem `processed_at`: só uma notificação processada com
-- sucesso bloqueia reentregas. Uma não processada pode ser retomada depois de
-- uma janela curta (ver recordWebhookEventOnce em lib/pedidos.ts).

alter table public.pedido_webhook_eventos
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz;

-- Última vez que o pedido foi conferido na Mercado Pago pela reconciliação.
alter table public.pedidos
  add column if not exists reconciliado_em timestamptz;

-- Fonte única de verdade de "quais pedidos a reconciliação deve conferir".
-- Usada pelo app (rota interna de reconciliação) e pelo disparo no banco
-- (pg_cron), para os dois nunca divergirem.
--   - ainda pendente e com order criada na Mercado Pago;
--   - dentro da validade do Pix ou até 1 hora depois (pagamento perto do
--     vencimento com webhook atrasado);
--   - não conferido nos últimos 30 segundos (evita martelar a API).
create or replace view public.pedidos_a_reconciliar
with (security_invoker = true) as
select id, mp_order_id, amount, reconciliado_em
from public.pedidos
where status = 'pendente'
  and mp_order_id is not null
  and expires_at is not null
  and expires_at > now() - interval '1 hour'
  and (reconciliado_em is null or reconciliado_em < now() - interval '30 seconds');
