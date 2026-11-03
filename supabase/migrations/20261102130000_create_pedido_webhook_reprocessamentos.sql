-- Fila de reprocessamento para notificações cujo GET /v1/orders/{id} na
-- Mercado Pago falhou (erro de rede, 5xx, ou order não encontrada). O
-- dedup de entrega (`pedido_webhook_eventos`) já consumiu o evento nesse
-- ponto, então sem isto a notificação nunca seria tentada de novo.

create table if not exists public.pedido_webhook_reprocessamentos (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  type text not null,
  data_id text not null,
  reason text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.pedido_webhook_reprocessamentos enable row level security;
